import type { ColumnOutputFormat } from "@/lib/ai-table-types";
import type { LLMProvider } from "@/components/ai/core/providers";

export interface AgentPresetSettingField {
  key: string;
  label: string;       // translation key
  placeholder: string; // translation key
  type: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;  // default true
}

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  systemPrompt: string;
  systemPromptTemplate?: string;
  settings?: AgentPresetSettingField[];
  provider: LLMProvider;
  model: string;
  tools: string[];
  outputFormat: ColumnOutputFormat;
  temperature?: number;
  maxTokens?: number;
  budgetTokens?: number;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "compliance-checker",
    name: "Compliance Checker",
    description: "Boolean pass/fail compliance check against requirements",
    icon: "ShieldCheck",
    systemPrompt:
      "You are a PPAP compliance auditor. For each document, determine whether it meets the required standards and specifications. Respond with PASS or FAIL, followed by a brief justification. Reference the specific requirement or standard that applies.",
    systemPromptTemplate:
      "You are a PPAP compliance auditor. For each document, check against the following standards and requirements:\n\n{{standardsToCheck}}\n\nRespond with PASS or FAIL, followed by a brief justification. Reference the specific requirement or standard that applies.",
    settings: [
      {
        key: "standardsToCheck",
        label: "complianceStandards",
        placeholder: "complianceStandardsPlaceholder",
        type: "textarea",
        required: true,
      },
    ],
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    tools: ["get_document_details", "search_documents", "get_checklist_details"],
    outputFormat: "boolean",
    temperature: 0,
    maxTokens: 512,
  },
  {
    id: "data-extractor",
    name: "Data Extractor",
    description: "Extract specific values from documents",
    icon: "FileSearch",
    systemPrompt:
      "You are a data extraction specialist. Extract the requested specific values, measurements, or data points from the document. Return only the extracted value(s) in a concise format. If the value is not found, state that clearly.",
    systemPromptTemplate:
      "You are a data extraction specialist. Extract the following values, measurements, or data points from the document:\n\n{{fieldsToExtract}}\n\nReturn only the extracted value(s) in a concise format. If a value is not found, state that clearly.",
    settings: [
      {
        key: "fieldsToExtract",
        label: "fieldsToExtract",
        placeholder: "fieldsToExtractPlaceholder",
        type: "textarea",
        required: true,
      },
    ],
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    tools: [
      "get_document_details",
      "get_document_chunks",
      "get_document_tables",
    ],
    outputFormat: "text",
    temperature: 0,
    maxTokens: 512,
  },
  {
    id: "document-summarizer",
    name: "Document Summarizer",
    description: "Summarize key points from documents",
    icon: "FileText",
    systemPrompt:
      "You are a technical document summarizer. Provide a concise summary of the key points, findings, and critical information in the document. Focus on quality-relevant data, measurements, and conclusions.",
    systemPromptTemplate:
      "You are a technical document summarizer. Provide a {{summaryLength}} summary of the key points, findings, and critical information in the document. Focus on quality-relevant data, measurements, and conclusions.{{#focusArea}} Pay special attention to: {{focusArea}}{{/focusArea}}",
    settings: [
      {
        key: "focusArea",
        label: "focusArea",
        placeholder: "focusAreaPlaceholder",
        type: "text",
        required: false,
      },
      {
        key: "summaryLength",
        label: "summaryLength",
        placeholder: "summaryLength",
        type: "select",
        options: [
          { value: "brief (1-2 sentence)", label: "summaryBrief" },
          { value: "standard (1 paragraph)", label: "summaryStandard" },
          { value: "detailed (multi-paragraph)", label: "summaryDetailed" },
        ],
        required: true,
      },
    ],
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    tools: ["get_document_details", "get_document_chunks"],
    outputFormat: "markdown",
    temperature: 0.2,
    maxTokens: 1024,
  },
  {
    id: "cross-reference-checker",
    name: "Cross-Reference Checker",
    description: "Compare documents against other docs for consistency",
    icon: "GitCompare",
    systemPrompt:
      "You are a cross-reference analyst. Compare the document against other documents in the submission to find inconsistencies, mismatches, or discrepancies in part numbers, revisions, dates, measurements, and specifications. Report each discrepancy found.",
    systemPromptTemplate:
      "You are a cross-reference analyst. Compare the document against other documents in the submission and check the following fields for consistency:\n\n{{fieldsToCompare}}\n\nReport each discrepancy found with specific references.",
    settings: [
      {
        key: "fieldsToCompare",
        label: "fieldsToCompare",
        placeholder: "fieldsToComparePlaceholder",
        type: "textarea",
        required: true,
      },
    ],
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    tools: ["get_document_details", "search_documents", "list_documents"],
    outputFormat: "badge",
    temperature: 0,
    maxTokens: 1024,
  },
  {
    id: "quality-auditor",
    name: "Quality Auditor",
    description: "Detailed quality analysis and risk assessment",
    icon: "ClipboardCheck",
    systemPrompt:
      "You are a quality auditor specializing in PPAP and automotive quality standards. Perform a detailed quality analysis of the document, identifying potential risks, non-conformances, and areas of concern. Provide actionable recommendations.",
    systemPromptTemplate:
      "You are a quality auditor specializing in PPAP and automotive quality standards. Perform a detailed quality analysis of the document against the following standards:\n\n{{auditStandards}}\n\n{{#riskFocus}}Pay special attention to these risk areas: {{riskFocus}}\n\n{{/riskFocus}}Identify potential risks, non-conformances, and areas of concern. Provide actionable recommendations.",
    settings: [
      {
        key: "auditStandards",
        label: "auditStandards",
        placeholder: "auditStandardsPlaceholder",
        type: "textarea",
        required: true,
      },
      {
        key: "riskFocus",
        label: "riskFocus",
        placeholder: "riskFocusPlaceholder",
        type: "text",
        required: false,
      },
    ],
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    tools: [
      "get_document_details",
      "search_documents",
      "search_regulations",
      "list_findings",
    ],
    outputFormat: "text",
    temperature: 0.1,
    maxTokens: 1024,
  },
];

/** Look up a preset by its ID */
export function getPresetById(id: string): AgentPreset | undefined {
  return AGENT_PRESETS.find((p) => p.id === id);
}

/** Interpolate {{key}} and {{#key}}...{{/key}} blocks in a template */
export function buildSystemPrompt(
  preset: AgentPreset,
  settings: Record<string, string>,
): string {
  const template = preset.systemPromptTemplate;
  if (!template) return preset.systemPrompt;

  let result = template;

  // Handle conditional blocks: {{#key}}content{{/key}} — included only when key has a value
  result = result.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key: string, content: string) => {
      const val = settings[key]?.trim();
      return val ? content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val) : "";
    },
  );

  // Handle simple {{key}} replacements
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return settings[key]?.trim() ?? "";
  });

  // Clean up any double newlines left from removed conditional blocks
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}
