import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { orchestrateDocs } from "@/server/docs/orchestrator";
import { executeSection } from "@/server/docs/section-executor";
import { generateFile } from "@/server/docs/file-generator";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AIDocSection, AIDocTemplate, AIDocSectionResult } from "@/lib/ai-doc-types";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const bucketName = process.env.AWS_S3_BUCKET_NAME || "";

const sectionDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["title", "text", "table", "chart", "summary", "keyValue", "bulletList", "comparison"]),
  prompt: z.string(),
  provider: z.enum(["anthropic", "openai", "mistral", "google", "ollama"]),
  model: z.string(),
});

export const docsRouter = createTRPCRouter({
  orchestrate: protectedProcedure
    .input(
      z.object({
        submissionId: z.string(),
        prompt: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return orchestrateDocs(input.submissionId, input.prompt);
    }),

  executeSection: protectedProcedure
    .input(
      z.object({
        submissionId: z.string(),
        section: sectionDefSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return executeSection(
        input.submissionId,
        input.section as AIDocSection,
      );
    }),

  generateFile: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.aIDocSession.findUnique({
        where: { id: input.sessionId },
      });
      if (!session || session.userId !== ctx.userId) {
        throw new Error("Session not found");
      }

      const template = session.template as unknown as AIDocTemplate;
      const sections = session.sections as unknown as Record<string, AIDocSectionResult>;

      const result = await generateFile(input.sessionId, template, sections);

      await ctx.db.aIDocSession.update({
        where: { id: input.sessionId },
        data: {
          s3Key: result.s3Key,
          filename: result.filename,
          status: "complete",
        },
      });

      return result;
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.aIDocSession.findUnique({
        where: { id: input.sessionId },
      });
      if (!session || session.userId !== ctx.userId || !session.s3Key) {
        throw new Error("Session not found or file not ready");
      }

      const url = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: bucketName,
          Key: session.s3Key,
          ResponseContentDisposition: `attachment; filename="${session.filename}"`,
        }),
        { expiresIn: 3600 },
      );

      return { url, filename: session.filename };
    }),

  saveOrchestrationMessage: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        userContent: z.string(),
        assistantContent: z.string(),
        orchestrationResult: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.chatThread.findFirst({
        where: { id: input.threadId, userId: ctx.userId },
      });
      if (!thread) throw new Error("Thread not found");

      const userMsg = await ctx.db.chatMessage.create({
        data: {
          threadId: input.threadId,
          role: "user",
          content: input.userContent,
        },
      });
      const assistantMsg = await ctx.db.chatMessage.create({
        data: {
          threadId: input.threadId,
          role: "assistant",
          content: input.assistantContent,
          metadata: { docsOrchestration: input.orchestrationResult },
        },
      });
      return { userMessage: userMsg, assistantMessage: assistantMsg };
    }),

  saveSession: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        submissionId: z.string(),
        messageId: z.string().optional(),
        template: z.any(),
        sections: z.any(),
        fileType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        return ctx.db.aIDocSession.update({
          where: { id: input.id },
          data: {
            template: input.template,
            sections: input.sections,
          },
        });
      }
      return ctx.db.aIDocSession.create({
        data: {
          submissionId: input.submissionId,
          messageId: input.messageId,
          template: input.template,
          sections: input.sections,
          fileType: input.fileType,
          userId: ctx.userId,
        },
      });
    }),

  loadSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.aIDocSession.findUnique({
        where: { id: input.id },
      });
    }),
});
