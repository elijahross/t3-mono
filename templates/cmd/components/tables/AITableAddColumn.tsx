"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  PlusIcon,
  ShieldCheckIcon,
  FileSearchIcon,
  FileTextIcon,
  GitCompareIcon,
  ClipboardCheckIcon,
  SlidersHorizontalIcon,
  PencilLineIcon,
  ArrowLeftIcon,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { AGENT_PRESETS, buildSystemPrompt } from "@/lib/ai-table-agent-presets";
import type { AgentPreset } from "@/lib/ai-table-agent-presets";
import type { AITableColumnDef, ColumnOutputFormat } from "@/lib/ai-table-types";

/* ── Icon map ── */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck: ShieldCheckIcon,
  FileSearch: FileSearchIcon,
  FileText: FileTextIcon,
  GitCompare: GitCompareIcon,
  ClipboardCheck: ClipboardCheckIcon,
};

/* ── Output format options ── */
const OUTPUT_FORMATS: ColumnOutputFormat[] = [
  "text",
  "number",
  "boolean",
  "json",
  "markdown",
  "badge",
];

/* ── Available tools ── */
const AVAILABLE_TOOLS = [
  { id: "get_document_details", label: "Document Details" },
  { id: "get_document_chunks", label: "Document Chunks" },
  { id: "get_document_tables", label: "Document Tables" },
  { id: "get_document_images", label: "Document Images" },
  { id: "get_finding_details", label: "Finding Details" },
  { id: "get_checklist_details", label: "Checklist Details" },
  { id: "get_document_type_definition", label: "Document Type Def" },
  { id: "search_documents", label: "Search Documents" },
  { id: "get_attachment_content", label: "Attachment Content" },
  { id: "search_attachment_chunks", label: "Search Attachments" },
  { id: "list_documents", label: "List Documents" },
  { id: "list_findings", label: "List Findings" },
  { id: "search_regulations", label: "Search Regulations" },
];

/* ── View state machine ── */
type AddColumnView =
  | { kind: "presetList" }
  | { kind: "presetSettings"; preset: AgentPreset }
  | { kind: "customForm" }
  | { kind: "userInputForm" };

interface AITableAddColumnProps {
  onAdd: (column: AITableColumnDef) => void;
}

function presetToColumn(
  preset: AgentPreset,
  systemPrompt: string,
  agentSettings?: Record<string, string>,
): AITableColumnDef {
  return {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: preset.name,
    description: preset.description,
    systemPrompt,
    provider: preset.provider,
    model: preset.model,
    tools: preset.tools,
    outputFormat: preset.outputFormat,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    budgetTokens: preset.budgetTokens,
    presetId: preset.id,
    agentSettings,
  };
}

export function AITableAddColumn({ onAdd }: AITableAddColumnProps) {
  const t = useTranslations("tables");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AddColumnView>({ kind: "presetList" });
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});

  /* ── User input form state ── */
  const [userInputName, setUserInputName] = useState("");

  /* ── Custom form state ── */
  const [customName, setCustomName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customModel, setCustomModel] = useState("claude-3-haiku-20240307");
  const [customFormat, setCustomFormat] = useState<ColumnOutputFormat>("text");
  const [customTools, setCustomTools] = useState<string[]>(["get_document_details", "search_documents"]);

  const handlePresetClick = (preset: AgentPreset) => {
    if (preset.settings && preset.settings.length > 0) {
      // Initialize default values for select fields
      const defaults: Record<string, string> = {};
      for (const field of preset.settings) {
        if (field.type === "select" && field.options?.[0]) {
          defaults[field.key] = field.options[0].value;
        }
      }
      setSettingsValues(defaults);
      setView({ kind: "presetSettings", preset });
    } else {
      onAdd(presetToColumn(preset, preset.systemPrompt));
      setOpen(false);
    }
  };

  const handlePresetSettingsSubmit = () => {
    if (view.kind !== "presetSettings") return;
    const { preset } = view;
    const prompt = buildSystemPrompt(preset, settingsValues);
    onAdd(presetToColumn(preset, prompt, settingsValues));
    setOpen(false);
    setView({ kind: "presetList" });
    setSettingsValues({});
  };

  const handleCustomSubmit = () => {
    if (!customName.trim()) return;
    const col: AITableColumnDef = {
      id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: customName.trim(),
      description: customName.trim(),
      systemPrompt: customPrompt,
      provider: customModel.startsWith("gpt") ? "openai" : "anthropic",
      model: customModel,
      tools: customTools,
      outputFormat: customFormat,
    };
    onAdd(col);
    setOpen(false);
    setView({ kind: "presetList" });
    setCustomName("");
    setCustomPrompt("");
    setCustomModel("claude-3-haiku-20240307");
    setCustomFormat("text");
    setCustomTools(["get_document_details", "search_documents"]);
  };

  const handleUserInputSubmit = () => {
    if (!userInputName.trim()) return;
    const col: AITableColumnDef = {
      id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: userInputName.trim(),
      description: "",
      systemPrompt: "",
      provider: "anthropic",
      model: "",
      tools: [],
      outputFormat: "text",
      isUserInput: true,
    };
    onAdd(col);
    setOpen(false);
    setView({ kind: "presetList" });
    setUserInputName("");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setView({ kind: "presetList" });
      setSettingsValues({});
      setUserInputName("");
    }
  };

  const isSettingsValid = (): boolean => {
    if (view.kind !== "presetSettings") return false;
    const { preset } = view;
    if (!preset.settings) return true;
    return preset.settings.every((field) => {
      if (field.required === false) return true;
      return (settingsValues[field.key] ?? "").trim().length > 0;
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex size-6 cursor-pointer items-center justify-center rounded transition-colors hover:bg-muted"
          title={t("addColumn")}
        >
          <PlusIcon className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[460px] w-72 overflow-y-auto p-0">
        {view.kind === "presetList" && (
          <div className="p-2">
            <p className="px-2 pb-2 text-[11px] font-medium text-muted-foreground">
              {t("selectAgent")}
            </p>
            <div className="space-y-0.5">
              {/* User Input option */}
              <button
                type="button"
                onClick={() => setView({ kind: "userInputForm" })}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
              >
                <PencilLineIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{t("userInputColumn")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("userInputColumnDescription")}
                  </p>
                </div>
              </button>
              <div className="my-1 border-t border-border" />
              {AGENT_PRESETS.map((preset) => {
                const Icon = ICON_MAP[preset.icon] ?? FileTextIcon;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{preset.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
              {/* Custom option */}
              <button
                type="button"
                onClick={() => setView({ kind: "customForm" })}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-md border-t border-border px-2 py-1.5 text-left transition-colors hover:bg-muted"
              >
                <SlidersHorizontalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{t("customColumn")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("customColumnDescription")}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {view.kind === "presetSettings" && (
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setView({ kind: "presetList" });
                  setSettingsValues({});
                }}
                className="flex cursor-pointer items-center justify-center rounded p-0.5 transition-colors hover:bg-muted"
              >
                <ArrowLeftIcon className="size-3.5 text-muted-foreground" />
              </button>
              <p className="text-xs font-medium">{view.preset.name}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("agentSettings")}
            </p>

            {view.preset.settings?.map((field) => (
              <div key={field.key}>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t(field.label)}
                  {field.required !== false && (
                    <span className="text-destructive"> *</span>
                  )}
                </label>
                {field.type === "textarea" && (
                  <textarea
                    value={settingsValues[field.key] ?? ""}
                    onChange={(e) =>
                      setSettingsValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    rows={3}
                    placeholder={t(field.placeholder)}
                    className="mt-1 block w-full resize-y rounded border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/50"
                  />
                )}
                {field.type === "text" && (
                  <input
                    type="text"
                    value={settingsValues[field.key] ?? ""}
                    onChange={(e) =>
                      setSettingsValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={t(field.placeholder)}
                    className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/50"
                  />
                )}
                {field.type === "select" && field.options && (
                  <select
                    value={settingsValues[field.key] ?? field.options[0]?.value ?? ""}
                    onChange={(e) =>
                      setSettingsValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs"
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.label)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePresetSettingsSubmit}
                disabled={!isSettingsValid()}
                className="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("addColumn")}
              </button>
            </div>
          </div>
        )}

        {view.kind === "userInputForm" && (
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setView({ kind: "presetList" });
                  setUserInputName("");
                }}
                className="flex cursor-pointer items-center justify-center rounded p-0.5 transition-colors hover:bg-muted"
              >
                <ArrowLeftIcon className="size-3.5 text-muted-foreground" />
              </button>
              <p className="text-xs font-medium">{t("userInputColumn")}</p>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("columnName")}
              </label>
              <input
                type="text"
                value={userInputName}
                onChange={(e) => setUserInputName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUserInputSubmit();
                }}
                className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs"
                placeholder={t("columnNamePlaceholder")}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleUserInputSubmit}
                disabled={!userInputName.trim()}
                className="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("addColumn")}
              </button>
              <button
                type="button"
                onClick={() => setView({ kind: "presetList" })}
                className="cursor-pointer rounded px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("back")}
              </button>
            </div>
          </div>
        )}

        {view.kind === "customForm" && (
          /* ── Custom column form ── */
          <div className="space-y-3 p-3">
            <p className="text-xs font-medium">{t("customColumn")}</p>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("columnName")}
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs"
                placeholder={t("columnNamePlaceholder")}
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("agentDescription")}
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                className="mt-1 block w-full resize-y rounded border border-border bg-background px-2 py-1 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("modelSelector")}
              </label>
              <select
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs"
              >
                <optgroup label="Anthropic">
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-3-haiku-20240307">Claude Haiku 3</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("tools")}
              </label>
              <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded border border-border p-2">
                {AVAILABLE_TOOLS.map((tool) => (
                  <label key={tool.id} className="flex items-center gap-1.5 text-[11px]">
                    <input
                      type="checkbox"
                      checked={customTools.includes(tool.id)}
                      onChange={(e) => {
                        setCustomTools((prev) =>
                          e.target.checked
                            ? [...prev, tool.id]
                            : prev.filter((t) => t !== tool.id)
                        );
                      }}
                      className="size-3 rounded"
                    />
                    {tool.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("outputFormat")}
              </label>
              <select
                value={customFormat}
                onChange={(e) =>
                  setCustomFormat(e.target.value as ColumnOutputFormat)
                }
                className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs"
              >
                {OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={!customName.trim()}
                className="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("addColumn")}
              </button>
              <button
                type="button"
                onClick={() => setView({ kind: "presetList" })}
                className="cursor-pointer rounded px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("back")}
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
