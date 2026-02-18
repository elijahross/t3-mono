import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  createLLM,
  ModelRegistry,
} from "@/components/ai/core/providers/index";
import { buildSubmissionContext } from "@/server/chat/context-builder";
import { db } from "@/server/db";
import type { TablesOrchestrationResult } from "@/lib/ai-table-types";

const ORCHESTRATOR_SYSTEM_PROMPT = `You are a PPAP analysis orchestration agent. Given a user's request and submission context, you design structured analysis tasks that can be executed across multiple documents in parallel — like a spreadsheet where each row is a document and each column is an AI agent task.

Your response MUST be valid JSON matching this schema (no markdown fences, no explanation — pure JSON only):
{
  "taskTitle": "string — short title for the analysis",
  "taskDescription": "string — 1-2 sentence description of what the analysis accomplishes",
  "useCases": [
    {
      "id": "string — unique kebab-case id",
      "name": "string — short display name (2-4 words)",
      "description": "string — what this use case does",
      "documentFilter": {
        "documentTypes": ["optional array of document type codes to include, omit to include all"]
      },
      "columns": [
        {
          "id": "string — unique kebab-case id",
          "name": "string — column header (2-4 words)",
          "description": "string — what this column extracts or validates per document",
          "systemPrompt": "string — the complete system prompt for the per-document LLM call. Must be self-contained.",
          "provider": "anthropic",
          "model": "claude-3-haiku-20240307",
          "tools": [],
          "outputFormat": "text",
          "temperature": 0.3,
          "maxTokens": 2048
        }
      ]
    }
  ]
}

## Guidelines

- Generate 2-3 use cases that approach the user's request from different angles or complexity levels
- Each use case should have 3-6 columns
- Column systemPrompts must be self-contained — they receive only the document's extracted content and metadata as input
- Choose models wisely for cost/quality:
  - "claude-3-haiku-20240307" for simple extraction, classification, boolean checks
  - "claude-sonnet-4-20250514" for analysis, reasoning, cross-referencing
- Available tools (only include if the column needs to look up other documents): get_document_details, get_document_chunks, get_document_tables, get_document_images, search_documents, list_documents, list_findings, search_regulations
- For simple extraction tasks, use tools: [] (the document content is passed directly)
- Output formats: "text" for free-form, "boolean" for pass/fail, "number" for numeric extraction, "json" for structured data, "markdown" for rich text, "badge" for status labels
- Make columns independent — each should work with just its document context unless it needs cross-document tools
- Keep column names short and descriptive for table headers
- Column systemPrompts should instruct the agent to provide concise 1-2 word answers. The system will automatically wrap prompts to request structured JSON output with {answer, detail, sourceText} fields.
- Design columns for short answers: "Compliant"/"Non-compliant", "Present"/"Missing", a part number, a revision, "Pass"/"Fail", a short status label, etc.
- Prefer outputFormat "badge" for status checks, "boolean" for pass/fail, "text" for short extracted values`;

export async function orchestrateTables(
  submissionId: string,
  userPrompt: string,
): Promise<TablesOrchestrationResult> {
  const submissionContext = await buildSubmissionContext(submissionId);

  const documents = await db.document.findMany({
    where: { submissionId },
    select: {
      id: true,
      filename: true,
      documentType: true,
      extractionStatus: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const llm = createLLM({
    provider: "anthropic",
    model: ModelRegistry.anthropic.sonnet,
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

  // Parse JSON — handle possible markdown code fences
  const stripped = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(stripped);

  return {
    submissionId,
    taskTitle: parsed.taskTitle,
    taskDescription: parsed.taskDescription,
    inputDocuments: documents.map((d) => ({
      documentId: d.id,
      filename: d.filename,
      documentType: d.documentType,
      extractionStatus: d.extractionStatus,
    })),
    useCases: parsed.useCases,
  };
}
