"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCwIcon, TrashIcon, ChevronDownIcon } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { AITableColumnDef, ColumnOutputFormat } from "@/lib/ai-table-types";
import { getPresetById, buildSystemPrompt } from "@/lib/ai-table-agent-presets";

interface AITableColumnHeaderProps {
  column: AITableColumnDef;
  onConfigure: (updated: AITableColumnDef) => void;
  onRemove: () => void;
  onRefresh?: (column: AITableColumnDef) => void;
}

const OUTPUT_FORMATS: ColumnOutputFormat[] = [
  "text",
  "number",
  "boolean",
  "json",
  "markdown",
  "badge",
];

const REASONING_OPTIONS: { label: string; key: string; value: number | undefined }[] = [
  { label: "reasoningOff", key: "off", value: undefined },
  { label: "reasoningLow", key: "low", value: 1024 },
  { label: "reasoningMedium", key: "medium", value: 5000 },
  { label: "reasoningHigh", key: "high", value: 10000 },
];

function budgetToKey(budget: number | undefined): string {
  if (!budget) return "off";
  if (budget <= 1024) return "low";
  if (budget <= 5000) return "medium";
  return "high";
}

export function AITableColumnHeader({
  column,
  onConfigure,
  onRemove,
  onRefresh,
}: AITableColumnHeaderProps) {
  const t = useTranslations("tables");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(column);
  const [draftSettings, setDraftSettings] = useState<Record<string, string>>(
    column.agentSettings ?? {},
  );
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);

  const preset = column.presetId ? getPresetById(column.presetId) : undefined;
  const hasSettings = preset?.settings && preset.settings.length > 0;

  // Sync draft when popover opens (in case column changed externally)
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(column);
      setDraftSettings(column.agentSettings ?? {});
      setShowAdvancedPrompt(false);
    }
    setOpen(next);
  };

  const buildUpdatedColumn = (): AITableColumnDef => {
    if (preset && hasSettings) {
      const newPrompt = buildSystemPrompt(preset, draftSettings);
      return { ...draft, systemPrompt: newPrompt, agentSettings: draftSettings };
    }
    return draft;
  };

  const handleSave = () => {
    onConfigure(buildUpdatedColumn());
    setOpen(false);
  };

  const handleRefresh = () => {
    const updated = buildUpdatedColumn();
    onConfigure(updated);
    setOpen(false);
    onRefresh?.(updated);
  };

  const isAnthropic = draft.provider === "anthropic";
  const supportsReasoning =
    isAnthropic &&
    (draft.model.includes("sonnet-4") || draft.model.includes("opus-4"));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer text-left"
          title={t("columnConfig")}
        >
          <p className="truncate text-xs font-medium">{column.name}</p>
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[400px] w-80 space-y-3 overflow-y-auto">
        {/* ── Column name (always shown) ── */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">
            {t("columnName")}
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) =>
              setDraft((d) => ({ ...d, name: e.target.value }))
            }
            className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </div>

        {/* ── AI-specific settings (hidden for user-input columns) ── */}
        {!column.isUserInput && (
          <>
            {hasSettings && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t("agentSettings")}
                </p>
                {preset!.settings!.map((field) => (
                  <div key={field.key}>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {t(field.label)}
                      {field.required !== false && (
                        <span className="text-destructive"> *</span>
                      )}
                    </label>
                    {field.type === "textarea" && (
                      <textarea
                        value={draftSettings[field.key] ?? ""}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
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
                        value={draftSettings[field.key] ?? ""}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
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
                        value={draftSettings[field.key] ?? field.options[0]?.value ?? ""}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
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
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("modelSelector")}
              </label>
              <select
                value={draft.model}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, model: e.target.value }))
                }
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
                {t("outputFormat")}
              </label>
              <select
                value={draft.outputFormat}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    outputFormat: e.target.value as ColumnOutputFormat,
                  }))
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

            {supportsReasoning && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t("reasoningLevel")}
                </label>
                <select
                  value={budgetToKey(draft.budgetTokens)}
                  onChange={(e) => {
                    const opt = REASONING_OPTIONS.find(
                      (o) => o.key === e.target.value,
                    );
                    setDraft((d) => ({
                      ...d,
                      budgetTokens: opt?.value,
                    }));
                  }}
                  className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  {REASONING_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {t(opt.label)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* System prompt: collapsible for preset columns, always visible for custom */}
            {hasSettings ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPrompt((v) => !v)}
                  className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronDownIcon
                    className={`size-3 transition-transform ${showAdvancedPrompt ? "" : "-rotate-90"}`}
                  />
                  {t("advancedPrompt")}
                </button>
                {showAdvancedPrompt && (
                  <textarea
                    value={draft.systemPrompt}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, systemPrompt: e.target.value }))
                    }
                    rows={4}
                    className="mt-1 block w-full resize-y rounded border border-border bg-background px-2 py-1 text-xs font-mono text-muted-foreground"
                  />
                )}
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t("agentDescription")}
                </label>
                <textarea
                  value={draft.systemPrompt}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, systemPrompt: e.target.value }))
                  }
                  rows={4}
                  className="mt-1 block w-full resize-y rounded border border-border bg-background px-2 py-1 text-xs"
                />
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("save")}
          </button>
          {!column.isUserInput && (
            <button
              type="button"
              onClick={handleRefresh}
              className="flex cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
            >
              <RefreshCwIcon className="size-3" />
              {t("refreshColumn")}
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
          >
            <TrashIcon className="size-3" />
            {t("removeColumn")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
