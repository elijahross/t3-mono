import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { buildSubmissionContext } from "@/server/chat/context-builder";
import { chatWithTools } from "@/server/chat/llm";
import { createLLM } from "@/components/ai/core/providers/index";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TextChunker, ChunkingPresets } from "@/components/ai/core/chunking";
import { EmbeddingGenerator } from "@/components/ai/core/embedding";
import { extractFromUrl } from "@/server/chat/docling-client";
import { db } from "@/server/db";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const bucketName = process.env.AWS_S3_BUCKET_NAME || "";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "text/html",
  "text/markdown",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

const viewContextSchema = z.object({
  submissionId: z.string().optional(),
  regulationCollectionId: z.string().optional(),
  findingId: z.string().optional(),
  documentId: z.string().optional(),
  chunkId: z.string().optional(),
  checklistId: z.string().optional(),
  documentTypeId: z.string().optional(),
}).optional();

export const chatRouter = createTRPCRouter({
  getOrCreateThread: protectedProcedure
    .input(z.object({ submissionId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Look for existing thread for this user + submission
      if (input.submissionId) {
        const existing = await ctx.db.chatThread.findFirst({
          where: {
            userId: ctx.userId,
            submissionId: input.submissionId,
          },
          orderBy: { updatedAt: "desc" },
        });
        if (existing) return existing;
      }

      return ctx.db.chatThread.create({
        data: {
          userId: ctx.userId,
          submissionId: input.submissionId ?? null,
        },
      });
    }),

  getMessages: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const thread = await ctx.db.chatThread.findFirst({
        where: { id: input.threadId, userId: ctx.userId },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.chatMessage.findMany({
        where: { threadId: input.threadId },
        orderBy: { createdAt: "asc" },
        take: input.limit,
      });
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      content: z.string().min(1),
      viewContext: viewContextSchema,
      attachmentIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.chatThread.findFirst({
        where: { id: input.threadId, userId: ctx.userId },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      // Build attachment metadata for user message
      let messageMetadata: Record<string, any> | undefined;
      if (input.attachmentIds && input.attachmentIds.length > 0) {
        const attachments = await ctx.db.chatAttachment.findMany({
          where: { id: { in: input.attachmentIds }, threadId: input.threadId },
          select: { filename: true },
        });
        messageMetadata = { attachments: attachments.map((a) => ({ filename: a.filename })) };
      }

      // Save user message
      const userMsg = await ctx.db.chatMessage.create({
        data: {
          threadId: input.threadId,
          role: "user",
          content: input.content,
          metadata: messageMetadata,
        },
      });

      // Build context — use viewContext.submissionId as fallback when thread has none
      const effectiveSubmissionId = thread.submissionId || input.viewContext?.submissionId;

      const submissionContext = effectiveSubmissionId
        ? await buildSubmissionContext(effectiveSubmissionId)
        : null;

      // Bind the submission to the thread so future messages work without viewContext
      if (!thread.submissionId && effectiveSubmissionId) {
        await ctx.db.chatThread.update({
          where: { id: input.threadId },
          data: { submissionId: effectiveSubmissionId },
        });
      }

      // Build focused context from viewContext
      const focusedContext = await buildFocusedContext(ctx.db, input.viewContext);

      // Build attachment context from completed attachments on this thread
      const attachmentContext = await buildAttachmentContext(ctx.db, input.threadId);

      // Fetch recent history for context window
      const history = await ctx.db.chatMessage.findMany({
        where: { threadId: input.threadId },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      const chatHistory = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Call LLM with tools
      const startMs = Date.now();
      const response = await chatWithTools(
        chatHistory,
        submissionContext,
        focusedContext,
        effectiveSubmissionId,
        attachmentContext || undefined,
        input.threadId,
        input.viewContext?.regulationCollectionId,
      );
      const latencyMs = Date.now() - startMs;

      // Save assistant message
      const assistantMsg = await ctx.db.chatMessage.create({
        data: {
          threadId: input.threadId,
          role: "assistant",
          content: response.content,
          metadata: {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            latencyMs,
            model: "claude-sonnet-4-20250514",
            toolCalls: response.toolCalls,
          },
        },
      });

      // Update thread title from first user message
      if (!thread.title) {
        const title =
          input.content.length > 60
            ? input.content.slice(0, 57) + "..."
            : input.content;
        await ctx.db.chatThread.update({
          where: { id: input.threadId },
          data: { title },
        });
      }

      // Touch updatedAt
      await ctx.db.chatThread.update({
        where: { id: input.threadId },
        data: { updatedAt: new Date() },
      });

      // Fire-and-forget: generate follow-up suggestions
      generateFollowUpSuggestions(ctx.db, assistantMsg.id, input.threadId).catch(() => {});

      return { userMessage: userMsg, assistantMessage: assistantMsg };
    }),

  getFollowUpSuggestions: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const message = await ctx.db.chatMessage.findUnique({
        where: { id: input.messageId },
        select: { metadata: true, thread: { select: { userId: true } } },
      });
      if (!message || message.thread.userId !== ctx.userId) return { suggestions: [] };
      const meta = message.metadata as Record<string, unknown> | null;
      return { suggestions: (meta?.followUpSuggestions as string[]) ?? [] };
    }),

  generateFollowUps: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.chatMessage.findUnique({
        where: { id: input.messageId },
        include: { thread: { select: { userId: true, submissionId: true } } },
      });
      if (!message || message.thread.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (message.role !== "assistant") {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      const suggestions = await generateFollowUpSuggestions(ctx.db, input.messageId, message.threadId);
      return { suggestions };
    }),

  // ========================================================================
  // Attachment procedures
  // ========================================================================

  getAttachmentUploadUrl: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      fileSize: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate thread ownership
      const thread = await ctx.db.chatThread.findFirst({
        where: { id: input.threadId, userId: ctx.userId },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      // Validate MIME type
      if (!ACCEPTED_MIME_TYPES.has(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported file type" });
      }

      // Validate file size
      if (input.fileSize && input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 50 MB)" });
      }

      const s3Key = `chat-attachments/${input.threadId}/${Date.now()}-${input.filename}`;
      const attachment = await ctx.db.chatAttachment.create({
        data: {
          filename: input.filename,
          mimeType: input.mimeType,
          s3Key,
          fileSize: input.fileSize,
          threadId: input.threadId,
        },
      });

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ContentType: input.mimeType,
      });
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return { attachmentId: attachment.id, uploadUrl, s3Key };
    }),

  processAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.chatAttachment.findUnique({
        where: { id: input.attachmentId },
        include: { thread: { select: { userId: true } } },
      });
      if (!attachment || attachment.thread.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Set IN_PROGRESS
      await ctx.db.chatAttachment.update({
        where: { id: input.attachmentId },
        data: { processingStatus: "IN_PROGRESS" },
      });

      try {
        const isImage = attachment.mimeType.startsWith("image/");

        if (isImage) {
          // Images: skip docling, store placeholder content
          await ctx.db.chatAttachment.update({
            where: { id: input.attachmentId },
            data: {
              extractedContent: `[Attached image: ${attachment.filename}]`,
              processingStatus: "COMPLETED",
            },
          });
          return { success: true, chunkCount: 0 };
        }

        // Documents: extract via docling
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: attachment.s3Key,
        });
        const presignedGetUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

        const { content } = await extractFromUrl(presignedGetUrl);

        // Chunk the content
        const chunker = new TextChunker({
          ...ChunkingPresets.contextual,
          strategy: "markdown",
        });
        const chunks = await chunker.chunk(content, {
          sourceFile: attachment.filename,
        });

        const chunkRecords = chunks.map((chunk) => ({
          content: chunk.content,
          chunkIndex: chunk.index,
          chunkType: detectChunkType(chunk.content),
          attachmentId: input.attachmentId,
        }));

        // Store chunks
        await ctx.db.chatAttachmentChunk.deleteMany({ where: { attachmentId: input.attachmentId } });
        if (chunkRecords.length > 0) {
          await ctx.db.chatAttachmentChunk.createMany({ data: chunkRecords });
        }

        // Generate embeddings
        try {
          const embeddingGen = new EmbeddingGenerator({
            provider: "ollama",
            model: process.env.EMBEDDING_MODEL || "nomic-embed-text",
            baseURL: process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
          });

          const texts = chunkRecords.map((c) => c.content);
          const batchResult = await embeddingGen.embedBatch(texts);

          // Store embeddings via raw SQL (same pattern as store-embeddings route)
          const vectors: string[] = [];
          const chunkIndices: number[] = [];
          for (let i = 0; i < batchResult.embeddings.length; i++) {
            vectors.push(`[${batchResult.embeddings[i]!.join(",")}]`);
            chunkIndices.push(i);
          }

          await db.$executeRawUnsafe(
            `UPDATE "ChatAttachmentChunk" AS cac
             SET embedding = data.vec::vector
             FROM unnest($1::text[], $2::int[]) AS data(vec, chunk_idx)
             WHERE cac."attachmentId" = $3 AND cac."chunkIndex" = data.chunk_idx`,
            vectors,
            chunkIndices,
            input.attachmentId,
          );
        } catch (embError: any) {
          console.warn("[processAttachment] Embedding generation failed (continuing):", embError?.message);
        }

        // Update attachment status
        await ctx.db.chatAttachment.update({
          where: { id: input.attachmentId },
          data: {
            extractedContent: content.slice(0, 10000),
            processingStatus: "COMPLETED",
          },
        });

        return { success: true, chunkCount: chunkRecords.length };
      } catch (error: any) {
        console.error("[processAttachment] Error:", error?.message);
        await ctx.db.chatAttachment.update({
          where: { id: input.attachmentId },
          data: { processingStatus: "FAILED", error: error?.message?.slice(0, 500) },
        });
        return { success: false, chunkCount: 0 };
      }
    }),

  listAttachments: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const thread = await ctx.db.chatThread.findFirst({
        where: { id: input.threadId, userId: ctx.userId },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.chatAttachment.findMany({
        where: { threadId: input.threadId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          fileSize: true,
          processingStatus: true,
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  updateMessageMetadata: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        sessionId: z.string().optional(),
        docSessionId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.chatMessage.findUnique({
        where: { id: input.messageId },
        include: { thread: { select: { userId: true } } },
      });
      if (!message || message.thread.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const existing = (message.metadata as Record<string, unknown>) ?? {};

      if (input.sessionId) {
        const sessionIds = Array.isArray(existing.tableSessionIds)
          ? (existing.tableSessionIds as string[])
          : [];
        if (!sessionIds.includes(input.sessionId)) {
          sessionIds.push(input.sessionId);
        }
        existing.tableSessionIds = sessionIds;
      }

      if (input.docSessionId) {
        const docSessionIds = Array.isArray(existing.docSessionIds)
          ? (existing.docSessionIds as string[])
          : [];
        if (!docSessionIds.includes(input.docSessionId)) {
          docSessionIds.push(input.docSessionId);
        }
        existing.docSessionIds = docSessionIds;
      }

      await ctx.db.chatMessage.update({
        where: { id: input.messageId },
        data: { metadata: existing as any },
      });
      return { success: true };
    }),

  listThreads: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.chatThread.findMany({
      where: { userId: ctx.userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
    });
  }),

  deleteThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.chatThread.findFirst({
        where: { id: input.threadId, userId: ctx.userId },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.chatThread.delete({ where: { id: input.threadId } });
      return { success: true };
    }),
});

// ============================================================================
// Follow-up suggestion generation
// ============================================================================

async function generateFollowUpSuggestions(
  prisma: typeof db,
  messageId: string,
  threadId: string,
): Promise<string[]> {
  const history = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { role: true, content: true },
  });

  const llm = createLLM({
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    temperature: 0.8,
    maxTokens: 256,
  });

  const result = await llm.invoke([
    new SystemMessage(
      "Generate 2-4 short follow-up questions or actions the user might want to take next, based on the conversation. Return ONLY a JSON array of strings, each 3-8 words. Focus on actionable next steps relevant to PPAP/quality review."
    ),
    ...history.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage("What follow-up questions should I suggest?"),
  ]);

  const content = typeof result.content === "string" ? result.content : "";
  let suggestions: string[] = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) suggestions = JSON.parse(match[0]);
  } catch { /* ignore parse errors */ }

  // Cache on message metadata
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { metadata: true },
  });
  const existing = (message?.metadata as Record<string, unknown>) ?? {};
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { metadata: { ...existing, followUpSuggestions: suggestions } },
  });

  return suggestions;
}

// ============================================================================
// Helpers
// ============================================================================

async function buildFocusedContext(
  prisma: any,
  viewContext?: z.infer<typeof viewContextSchema>,
): Promise<string> {
  if (!viewContext) return "";

  const sections: string[] = [];

  if (viewContext.findingId) {
    const finding = await prisma.finding.findUnique({
      where: { id: viewContext.findingId },
      select: { severity: true, category: true, title: true, description: true },
    });
    if (finding) {
      sections.push(
        `### Currently Viewing: Finding\n[${finding.severity}] ${finding.title}\nCategory: ${finding.category}\n${finding.description}`,
      );
    }
  }

  if (viewContext.documentId) {
    const doc = await prisma.document.findUnique({
      where: { id: viewContext.documentId },
      select: { filename: true, documentType: true, mimeType: true },
    });
    if (doc) {
      sections.push(
        `### Currently Viewing: Document\n${doc.filename} (${doc.documentType ?? "unclassified"})`,
      );
    }
  }

  if (viewContext.checklistId) {
    const checklist = await prisma.checklist.findUnique({
      where: { id: viewContext.checklistId },
      select: { name: true, ppapLevel: true, _count: { select: { items: true } } },
    });
    if (checklist) {
      sections.push(
        `### Currently Viewing: Checklist\n${checklist.name} — Level ${checklist.ppapLevel}, ${checklist._count.items} elements`,
      );
    }
  }

  if (viewContext.documentTypeId) {
    const typeDef = await prisma.documentTypeDefinition.findUnique({
      where: { id: viewContext.documentTypeId },
      select: { code: true, label: true, description: true },
    });
    if (typeDef) {
      sections.push(
        `### Currently Viewing: Document Type\n${typeDef.code}: ${typeDef.label}${typeDef.description ? `\n${typeDef.description}` : ""}`,
      );
    }
  }

  if (viewContext.regulationCollectionId) {
    const collection = await prisma.regulationCollection.findUnique({
      where: { id: viewContext.regulationCollectionId },
      select: {
        name: true,
        description: true,
        _count: { select: { documents: true, requirements: true } },
      },
    });
    if (collection) {
      sections.push(
        `### Currently Viewing: Regulation Collection\n${collection.name}${collection.description ? `\n${collection.description}` : ""}\nDocuments: ${collection._count.documents}, Requirements: ${collection._count.requirements}`,
      );
    }
  }

  return sections.join("\n\n");
}

async function buildAttachmentContext(
  prisma: any,
  threadId: string,
): Promise<string | null> {
  const attachments = await prisma.chatAttachment.findMany({
    where: { threadId, processingStatus: "COMPLETED" },
    select: { id: true, filename: true, mimeType: true },
  });
  if (attachments.length === 0) return null;

  const lines = attachments.map(
    (a: any) => `- ${a.filename} (${a.mimeType}) [id: ${a.id}]`,
  );
  return lines.join("\n");
}

function detectChunkType(content: string): "TEXT" | "TABLE" | "HEADER" | "FORM_FIELD" | "LIST" | "IMAGE_DESCRIPTION" {
  const trimmed = content.trim();
  if (/^\[Table \d+:/.test(trimmed)) return "TABLE";
  if (/^\[Image \d+:/.test(trimmed)) return "IMAGE_DESCRIPTION";
  if (trimmed.startsWith("|") && trimmed.includes("---")) return "TABLE";
  if (trimmed.startsWith("#")) return "HEADER";
  if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return "LIST";
  if (/^[A-Z][a-zA-Z\s]+:\s/.test(trimmed) && trimmed.split("\n").length < 5) return "FORM_FIELD";
  return "TEXT";
}
