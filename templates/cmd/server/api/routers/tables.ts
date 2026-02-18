import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { orchestrateTables } from "@/server/tables/orchestrator";
import { executeCell } from "@/server/tables/column-executor";
import type { AITableColumnDef } from "@/lib/ai-table-types";

const columnDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  provider: z.enum(["anthropic", "openai", "mistral", "google", "ollama"]),
  model: z.string(),
  tools: z.array(z.string()),
  outputFormat: z.enum(["text", "number", "boolean", "json", "markdown", "badge"]),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  budgetTokens: z.number().optional(),
  presetId: z.string().optional(),
  agentSettings: z.record(z.string(), z.string()).optional(),
});

export const tablesRouter = createTRPCRouter({
  orchestrate: protectedProcedure
    .input(
      z.object({
        submissionId: z.string(),
        prompt: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return orchestrateTables(input.submissionId, input.prompt);
    }),

  executeCell: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        submissionId: z.string(),
        column: columnDefSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return executeCell(
        input.documentId,
        input.submissionId,
        input.column as AITableColumnDef,
      );
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
          metadata: { tablesOrchestration: input.orchestrationResult },
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
        useCase: z.any(),
        columns: z.any(),
        results: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        return ctx.db.aITableSession.update({
          where: { id: input.id },
          data: {
            useCase: input.useCase,
            columns: input.columns,
            results: input.results,
          },
        });
      }
      return ctx.db.aITableSession.create({
        data: {
          submissionId: input.submissionId,
          messageId: input.messageId,
          useCase: input.useCase,
          columns: input.columns,
          results: input.results,
          userId: ctx.userId,
        },
      });
    }),

  loadSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.aITableSession.findUnique({
        where: { id: input.id },
      });
    }),

  listSessions: protectedProcedure
    .input(z.object({ submissionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.aITableSession.findMany({
        where: { submissionId: input.submissionId, userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          useCase: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }),
});
