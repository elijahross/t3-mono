"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  SearchIcon,
  SparklesIcon,
  XIcon,
  ArrowUpIcon,
  PaperclipIcon,
  PanelRightIcon,
  Loader2Icon,
  CheckIcon,
  AlertCircleIcon,
  SlidersHorizontalIcon,
  FolderIcon,
  FileTextIcon,
  AlertTriangleIcon,
  TextIcon,
  ClipboardListIcon,
  TagIcon,
  BookOpenIcon,
  TableIcon,
  LightbulbIcon,
  FileOutputIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useCommandIsland } from "@/lib/command-island-context";
import { useViewState } from "@/lib/view-state";
import { useSplitView } from "@/lib/split-view-context";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { trpc } from "@/lib/trpc";

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.html,.md,.txt,.png,.jpg,.jpeg";
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
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

type SuggestionType = "query" | "table";
interface QuickSuggestion {
  id: string;
  label: string;
  type: SuggestionType;
  prompt: string;
}
const QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { id: "summarize", label: "suggestSummarize", type: "query", prompt: "Summarize this PPAP submission and highlight key findings" },
  { id: "compliance", label: "suggestCompliance", type: "table", prompt: "Check compliance of all documents" },
  { id: "findings", label: "suggestFindings", type: "query", prompt: "List all findings and their severity" },
  { id: "cross-ref", label: "suggestCrossRef", type: "table", prompt: "Cross-reference documents for consistency" },
  { id: "risks", label: "suggestRisks", type: "query", prompt: "What are the main quality risks in this submission?" },
  { id: "extract-data", label: "suggestExtractData", type: "table", prompt: "Extract key measurements and values from all documents" },
];

interface PendingAttachment {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "ready" | "error";
}

export function CommandIsland() {
  const t = useTranslations("commandIsland");
  const ctx = useCommandIsland();
  const { query, setQuery, mode, setMode, hasQueryConsumer, placeholder, currentSubmissionId } = ctx;
  const { rightPanel, openPanel, closePanel } = useSplitView();

  const [aiInput, setAiInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const viewState = useViewState();

  const contextEntries = [
    { key: "submissionId" as const, label: t("contextSubmission"), icon: FolderIcon },
    { key: "documentId" as const, label: t("contextDocument"), icon: FileTextIcon },
    { key: "findingId" as const, label: t("contextFinding"), icon: AlertTriangleIcon },
    { key: "chunkId" as const, label: t("contextChunk"), icon: TextIcon },
    { key: "checklistId" as const, label: t("contextChecklist"), icon: ClipboardListIcon },
    { key: "documentTypeId" as const, label: t("contextDocType"), icon: TagIcon },
    { key: "regulationCollectionId" as const, label: t("contextRegulation"), icon: BookOpenIcon },
  ] as const;
  const activeEntries = contextEntries.filter((e) => viewState[e.key]);
  const contextCount = activeEntries.length;
  const hasActiveContext = contextCount > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default to AI mode when no query consumer
  useEffect(() => {
    if (!hasQueryConsumer && mode === "query") {
      setMode("ai");
    }
  }, [hasQueryConsumer, mode, setMode]);

  // Auto-resize textarea in AI/Tables mode
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [aiInput]);

  const ensureThreadId = async (): Promise<string> => {
    if (ctx.currentThreadId) return ctx.currentThreadId;
    const thread = await trpc.chat.getOrCreateThread.mutate({
      submissionId: currentSubmissionId ?? undefined,
    });
    ctx.setCurrentThreadId(thread.id);
    return thread.id;
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;

    // Client-side validation
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      toast.error(t("unsupportedFileType"));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("fileTooLarge"));
      return;
    }

    try {
      const threadId = await ensureThreadId();

      // Get presigned upload URL
      const { attachmentId, uploadUrl } = await trpc.chat.getAttachmentUploadUrl.mutate({
        threadId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      // Add to pending
      setPendingAttachments((prev) => [
        ...prev,
        { id: attachmentId, filename: file.name, status: "uploading" },
      ]);

      // Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Process (extract + chunk + embed)
      setPendingAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? { ...a, status: "processing" } : a)),
      );

      const result = await trpc.chat.processAttachment.mutate({ attachmentId });

      setPendingAttachments((prev) =>
        prev.map((a) =>
          a.id === attachmentId
            ? { ...a, status: result.success ? "ready" : "error" }
            : a,
        ),
      );
    } catch (err: any) {
      console.error("[CommandIsland] File upload error:", err?.message);
      toast.error(err?.message || "Upload failed");
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAiSubmit = () => {
    if (!aiInput.trim() && pendingAttachments.length === 0) return;
    if (ctx.onAiSubmit) {
      const readyIds = pendingAttachments
        .filter((a) => a.status === "ready")
        .map((a) => a.id);
      ctx.onAiSubmit(aiInput.trim(), readyIds.length > 0 ? readyIds : undefined);
      // Switch back to query mode only when the panel isn't already open,
      // so an initial submit opens the chat and then yields to its own input.
      // When the panel is already open, keep AI mode to avoid jarring resets.
      if (hasQueryConsumer && !rightPanel.open) {
        setMode("query");
      }
    } else {
      toast(t("comingSoon"));
    }
    setAiInput("");
    setPendingAttachments([]);
  };

  const handleTablesSubmit = () => {
    if (!aiInput.trim()) return;
    if (ctx.onTablesSubmit) {
      ctx.onTablesSubmit(aiInput.trim());
    } else {
      toast(t("comingSoon"));
    }
    setAiInput("");
  };

  const handleDocsSubmit = () => {
    if (!aiInput.trim()) return;
    if (ctx.onDocsSubmit) {
      ctx.onDocsSubmit(aiInput.trim());
    } else {
      toast(t("comingSoon"));
    }
    setAiInput("");
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (effectiveMode === "tables") {
        handleTablesSubmit();
      } else if (effectiveMode === "docs") {
        handleDocsSubmit();
      } else {
        handleAiSubmit();
      }
    }
  };

  const handleQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      inputRef.current?.blur();
    }
  };

  const handleToggleChat = () => {
    if (rightPanel.open) {
      closePanel("right");
    } else {
      openPanel(
        "right",
        <ChatPanel submissionId={currentSubmissionId} />,
      );
    }
  };

  const handleSuggestionClick = (s: QuickSuggestion) => {
    setShowSuggestions(false);
    // Route through the wiring components (ChatWiring / TablesWiring) which
    // handle both panel-open (direct callback) and panel-closed (open new
    // ChatPanel with initialMessage / tablesPrompt) cases.
    if (s.type === "table") {
      if (ctx.onTablesSubmit) {
        ctx.onTablesSubmit(s.prompt);
      }
    } else {
      if (ctx.onAiSubmit) {
        ctx.onAiSubmit(s.prompt);
      }
    }
  };

  const effectiveMode = !hasQueryConsumer ? (mode === "query" ? "ai" : mode) : mode;
  const isTextareaMode = effectiveMode === "ai" || effectiveMode === "tables" || effectiveMode === "docs";

  return (
    <div className="fixed bottom-0 inset-x-0 z-70 pointer-events-none pb-4 px-4 sm:px-6">
      {/* Context badges layer — slightly darker, appears behind the island */}
      {showContext && hasActiveContext && (
        <div className="pointer-events-auto mx-auto max-w-2xl -mb-3 rounded-t-2xl px-4 pt-2.5 pb-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {activeEntries.map((entry) => {
              const Icon = entry.icon;
              return (
                <Badge
                  key={entry.key}
                  variant="outline"
                  className="text-[10px] gap-1 select-none bg-background"
                  title={`ID: ${viewState[entry.key]}`}
                >
                  <Icon className="size-2.5" />
                  {entry.label}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
      {/* Suggestion badges panel */}
      {showSuggestions && (
        <div className="pointer-events-auto mx-auto max-w-2xl -mb-3 rounded-t-2xl px-4 pt-2.5 pb-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_SUGGESTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => handleSuggestionClick(s)} className="cursor-pointer">
                <Badge variant="secondary" className="gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors">
                  {s.type === "table" ? <TableIcon className="size-2.5" /> : <SparklesIcon className="size-2.5" />}
                  {t(s.label)}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Main island card */}
      <div
        className={cn(
          "pointer-events-auto mx-auto max-w-2xl rounded-2xl border bg-card shadow-lg transition-shadow duration-200",
          focused
            ? "shadow-xl border-primary/30 ring-1 ring-primary/20"
            : "border-border shadow-lg"
        )}
      >
        {/* Attachment chips */}
        {effectiveMode === "ai" && pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-0">
            {pendingAttachments.map((a) => (
              <span
                key={a.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  a.status === "ready"
                    ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                    : a.status === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                      : "border-border bg-muted text-muted-foreground"
                )}
              >
                {a.status === "uploading" || a.status === "processing" ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : a.status === "ready" ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <AlertCircleIcon className="size-3" />
                )}
                <span className="max-w-[120px] truncate">{a.filename}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(a.id)}
                  className="ml-0.5 cursor-pointer rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={t("removeAttachment")}
                >
                  <XIcon className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input area — fixed min-height so mode switch doesn't shift layout */}
        <div className="flex items-end gap-2 px-4 pt-3 pb-2 min-h-[44px]">
          {effectiveMode === "query" ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleQueryKeyDown}
              placeholder={placeholder || t("defaultPlaceholder")}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none h-[24px] leading-relaxed"
            />
          ) : (
            <textarea
              ref={textareaRef}
              rows={1}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={effectiveMode === "tables" ? t("tablesPlaceholder") : effectiveMode === "docs" ? t("docsPlaceholder") : t("aiPlaceholder")}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[120px] py-0 leading-relaxed"
            />
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_EXTENSIONS}
          onChange={(e) => {
            handleFileSelected(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          {/* Left: mode toggle */}
          <div className="flex items-center gap-1">
            {hasQueryConsumer ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode("query")}
                  title={t("queryMode")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                    effectiveMode === "query"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <SearchIcon className="h-3 w-3" />
                  <span className="text-[11px] font-medium">{t("queryMode")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("ai")}
                  title={t("aiMode")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                    effectiveMode === "ai"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <SparklesIcon className="h-3 w-3" />
                  <span className="text-[11px] font-medium select-none">{t("aiMode")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("tables")}
                  title={t("tablesMode")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                    effectiveMode === "tables"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <TableIcon className="h-3 w-3" />
                  <span className="text-[11px] font-medium select-none">{t("tablesMode")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("docs")}
                  title={t("docsMode")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                    effectiveMode === "docs"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <FileOutputIcon className="h-3 w-3" />
                  <span className="text-[11px] font-medium select-none">{t("docsMode")}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMode("ai")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                    effectiveMode === "ai"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <SparklesIcon className="h-3 w-3" />
                  <span className="text-[11px] font-medium select-none">{t("aiMode")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("tables")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                    effectiveMode === "tables"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <TableIcon className="h-3 w-3" />
                  <span className="text-[11px] font-medium select-none">{t("tablesMode")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("docs")}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                    effectiveMode === "docs"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <FileOutputIcon className="h-3 w-3" />
                  <span className="text-[11px] font-medium select-none">{t("docsMode")}</span>
                </button>
              </div>
            )}
          </div>

          {/* Right actions — fixed height to prevent layout shift */}
          <div className="flex h-8 items-center justify-end gap-1 min-w-[4.25rem]">
            {isTextareaMode && (
              <button
                type="button"
                onClick={() => setShowSuggestions((v) => !v)}
                className={cn(
                  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
                  showSuggestions
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-label={t("aiSuggestions")}
                title={t("aiSuggestions")}
              >
                <LightbulbIcon className="h-4 w-4" />
              </button>
            )}
            {isTextareaMode && (<button
              type="button"
              onClick={() => setShowContext((v) => !v)}
              className={cn(
                "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
                showContext
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              aria-label={t("toggleContext")}
              title={t("toggleContext")}
            >
              <SlidersHorizontalIcon className="h-4 w-4" />
            </button>)}
            <button
              type="button"
              onClick={handleToggleChat}
              className={cn(
                "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
                rightPanel.open
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              aria-label={t("toggleChat")}
              title={t("toggleChat")}
            >
              <PanelRightIcon className="h-4 w-4" />
            </button>
            {effectiveMode === "query" ? (
              query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={t("clearQuery")}
                  title={t("clearQuery")}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null
            ) : (
              <>
                {effectiveMode === "ai" && (
                  <button
                    type="button"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={t("attach")}
                    title={t("attach")}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <PaperclipIcon className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={effectiveMode === "tables" ? handleTablesSubmit : effectiveMode === "docs" ? handleDocsSubmit : handleAiSubmit}
                  disabled={
                    effectiveMode === "tables" || effectiveMode === "docs"
                      ? !aiInput.trim()
                      : !aiInput.trim() && pendingAttachments.filter((a) => a.status === "ready").length === 0
                  }
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150",
                    (effectiveMode === "tables" || effectiveMode === "docs" ? aiInput.trim() : aiInput.trim() || pendingAttachments.some((a) => a.status === "ready"))
                      ? "cursor-pointer bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground cursor-not-allowed"
                  )}
                  aria-label={t("send")}
                  title={t("send")}
                >
                  <ArrowUpIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
