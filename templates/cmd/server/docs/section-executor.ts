import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { createLLM } from "@/components/ai/core/providers/index";
import { buildSubmissionContext } from "@/server/chat/context-builder";
import { sanitizeAndParseJSON } from "@/server/docs/json-utils";
import type { AIDocSection } from "@/lib/ai-doc-types";

export interface SectionExecutionResult {
  content: unknown;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

export async function executeSection(
  submissionId: string,
  section: AIDocSection,
): Promise<SectionExecutionResult> {
  const startMs = Date.now();
  const submissionContext = await buildSubmissionContext(submissionId);

  const llm = createLLM({
    provider: section.provider,
    model: section.model,
    temperature: 0.3,
    maxTokens: 4096,
  });

  const systemPrompt = `${section.prompt}

IMPORTANT: You MUST respond with valid JSON only, no markdown fences, no other text.
The JSON must match the schema for section type "${section.type}":
${getSchemaForType(section.type)}`;

  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`## Submission Context\n${submissionContext}`),
  ]);

  const usage = (result.usage_metadata ?? {}) as Record<string, number>;
  const content =
    typeof result.content === "string"
      ? result.content
      : JSON.stringify(result.content);

  const parsed = sanitizeAndParseJSON(content);

  return {
    content: parsed,
    usage: {
      inputTokens: (usage.input_tokens as number) ?? 0,
      outputTokens: (usage.output_tokens as number) ?? 0,
    },
    latencyMs: Date.now() - startMs,
  };
}

function getSchemaForType(type: string): string {
  switch (type) {
    case "title":
      return '{"heading": "string", "subtitle": "string"}';
    case "text":
      return '{"body": "string (markdown ok)"}';
    case "table":
      return '{"headers": ["string"], "rows": [["string"]]}';
    case "chart":
      return '{"chartType": "bar|pie|line", "labels": ["string"], "values": [number], "title": "string"}';
    case "summary":
      return '{"heading": "string", "points": ["string"]}';
    case "keyValue":
      return '{"pairs": [{"key": "string", "value": "string"}]}';
    case "bulletList":
      return '{"heading": "string", "items": ["string"]}';
    case "comparison":
      return '{"heading": "string", "columns": ["string"], "rows": [{"label": "string", "values": ["string"]}]}';
    default:
      return '{"body": "string"}';
  }
}
