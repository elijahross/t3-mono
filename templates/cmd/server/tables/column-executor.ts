import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { createLLM } from "@/components/ai/core/providers/index";
import { chatTools, executeChatTool } from "@/server/chat/chat-tools";
import { db } from "@/server/db";
import type { AITableColumnDef } from "@/lib/ai-table-types";

const MAX_TOOL_ITERATIONS = 4;

export interface CellExecutionResult {
  result: string;      // concise 1-2 word answer
  detail?: string;     // full explanation
  sourceText?: string; // exact quote from source document
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

export async function executeCell(
  documentId: string,
  submissionId: string,
  column: AITableColumnDef,
): Promise<CellExecutionResult> {
  const startMs = Date.now();

  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      filename: true,
      documentType: true,
      extractedContent: true,
      extractedData: true,
    },
  });

  if (!doc) throw new Error(`Document ${documentId} not found`);

  const llm = createLLM({
    provider: column.provider,
    model: column.model,
    temperature: column.temperature ?? 0.3,
    maxTokens: column.maxTokens ?? 2048,
    budgetTokens: column.budgetTokens,
  });

  // Build document context passed as the user message
  const docContext = [
    `Document: ${doc.filename}`,
    `Type: ${doc.documentType ?? "unclassified"}`,
    doc.extractedData
      ? `Extracted Data:\n${JSON.stringify(doc.extractedData, null, 2)}`
      : null,
    `Content:\n${(doc.extractedContent ?? "").slice(0, 15000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Filter to only the tools this column is allowed to use
  const allowedTools = chatTools.filter((t) =>
    column.tools.includes(t.name),
  );

  // Wrap column prompt to request structured JSON with concise answer + detail + source reference
  const wrappedPrompt = `${column.systemPrompt}

IMPORTANT: You MUST respond with valid JSON only, no markdown fences, no other text:
{"answer": "<1-2 word concise answer>", "detail": "<full explanation of your reasoning>", "sourceText": "<exact quote from the document that supports your answer>"}`;

  const messages: any[] = [
    new SystemMessage(wrappedPrompt),
    new HumanMessage(docContext),
  ];

  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const isLast = i === MAX_TOOL_ITERATIONS - 1;

    if (isLast && allowedTools.length > 0) {
      messages.push(
        new HumanMessage("Provide your final answer now. No more tool calls."),
      );
    }

    const model =
      isLast || allowedTools.length === 0
        ? llm
        : (llm as any).bindTools(allowedTools);

    const result = await model.invoke(messages);
    const usage = result.usage_metadata ?? {};
    totalInput += usage.input_tokens ?? 0;
    totalOutput += usage.output_tokens ?? 0;

    const content =
      typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content);
    const toolCalls = (result as any).tool_calls || [];

    messages.push(new AIMessage({ content, tool_calls: toolCalls }));

    // No tool calls — we have our final answer
    if (toolCalls.length === 0) {
      return {
        ...parseStructuredResponse(content),
        usage: { inputTokens: totalInput, outputTokens: totalOutput },
        latencyMs: Date.now() - startMs,
      };
    }

    // Execute each tool call
    for (const call of toolCalls) {
      const toolResult = await executeChatTool(
        call.name,
        call.args,
        submissionId,
      );
      messages.push(
        new ToolMessage({
          content: JSON.stringify(toolResult),
          tool_call_id: call.id,
        }),
      );
    }
  }

  // Fallback — return the last AI content
  const lastAi = messages
    .filter((m: any) => m instanceof AIMessage)
    .pop();

  const fallbackContent =
    typeof lastAi?.content === "string"
      ? lastAi.content
      : "Analysis incomplete";

  return {
    ...parseStructuredResponse(fallbackContent),
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
    latencyMs: Date.now() - startMs,
  };
}

/** Parse the LLM's structured JSON response into {result, detail, sourceText} */
function parseStructuredResponse(content: string): {
  result: string;
  detail?: string;
  sourceText?: string;
} {
  try {
    const stripped = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(stripped);
    if (parsed.answer) {
      return {
        result: String(parsed.answer),
        detail: parsed.detail ? String(parsed.detail) : undefined,
        sourceText: parsed.sourceText ? String(parsed.sourceText) : undefined,
      };
    }
  } catch {
    // Not valid JSON — fall through
  }
  // Fallback: use first 50 chars as concise result, full content as detail
  return {
    result: content.slice(0, 50).replace(/\n/g, " ").trim(),
    detail: content,
  };
}
