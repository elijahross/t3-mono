import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  createLLM,
  ModelRegistry,
} from "@/components/ai/core/providers/index";
import { buildSubmissionContext } from "@/server/chat/context-builder";
import { sanitizeAndParseJSON } from "@/server/docs/json-utils";
import type { DocsOrchestrationResult } from "@/lib/ai-doc-types";

const ORCHESTRATOR_SYSTEM_PROMPT = `You are a PPAP document generation orchestration agent. Given a user's request and submission context, you design structured document templates that can be generated from the submission data.

Your response MUST be valid JSON matching this schema (no markdown fences, no explanation — pure JSON only):
{
  "taskTitle": "string — short title for the document generation task",
  "taskDescription": "string — 1-2 sentence description of what will be generated",
  "templates": [
    {
      "id": "string — unique kebab-case id",
      "name": "string — display name (e.g. 'Executive Summary')",
      "description": "string — what this document contains",
      "fileType": "pptx | xlsx | pdf",
      "style": {
        "primaryColor": "#hex color for headings/accents",
        "fontFamily": "Arial"
      },
      "sections": [
        {
          "id": "string — unique kebab-case id",
          "name": "string — section title",
          "type": "title | text | table | chart | summary | keyValue | bulletList | comparison",
          "prompt": "string — the complete prompt for the LLM to generate this section's content. Must be self-contained.",
          "provider": "anthropic",
          "model": "claude-3-haiku-20240307"
        }
      ]
    }
  ]
}

## Section Type Content Schemas

Each section type expects the LLM to return structured JSON:

- **title**: {"heading": "string", "subtitle": "string"}
- **text**: {"body": "string (markdown ok)"}
- **table**: {"headers": ["string"], "rows": [["string"]]}
- **chart**: {"chartType": "bar|pie|line", "labels": ["string"], "values": [number], "title": "string"}
- **summary**: {"heading": "string", "points": ["string"]}
- **keyValue**: {"pairs": [{"key": "string", "value": "string"}]}
- **bulletList**: {"heading": "string", "items": ["string"]}
- **comparison**: {"heading": "string", "columns": ["string"], "rows": [{"label": "string", "values": ["string"]}]}

## Guidelines

- Generate 2-3 templates that approach the user's request from different angles
- Choose file types wisely:
  - "pptx" for presentations, executive summaries, visual reports
  - "xlsx" for data exports, matrices, tabular comparisons
  - "pdf" for formal reports, compliance documents, detailed write-ups
- Each template should have 3-8 sections
- Section prompts must be self-contained — they receive the full submission context
- Choose models wisely:
  - "claude-3-haiku-20240307" for simple extraction, formatting, data transformation
  - "claude-sonnet-4-20250514" for analysis, synthesis, complex reasoning
- Keep section names concise for slide titles / sheet names / headings`;

export async function orchestrateDocs(
  submissionId: string,
  userPrompt: string,
): Promise<DocsOrchestrationResult> {
  const submissionContext = await buildSubmissionContext(submissionId);

  const llm = createLLM({
    provider: "anthropic",
    model: ModelRegistry.anthropic.haiku,
    temperature: 0.5,
    maxTokens: 4096,
  });

  const result = await llm.invoke([
    new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT),
    new HumanMessage(
      `## Submission Context\n${submissionContext}\n\n## User Request\n${userPrompt}`,
    ),
  ]);

  const content =
    typeof result.content === "string"
      ? result.content
      : JSON.stringify(result.content);

  const parsed = sanitizeAndParseJSON(content) as Record<string, unknown>;

  return {
    submissionId,
    taskTitle: parsed.taskTitle as string,
    taskDescription: parsed.taskDescription as string,
    templates: parsed.templates as DocsOrchestrationResult["templates"],
  };
}
