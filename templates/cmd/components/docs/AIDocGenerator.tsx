"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  AlertCircleIcon,
  DownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
  FileTextIcon,
  PresentationIcon,
  TableIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { createConcurrencyLimiter } from "@/lib/concurrency";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  AIDocTemplate,
  AIDocSectionResult,
  DocSectionStatus,
} from "@/lib/ai-doc-types";

const limiter = createConcurrencyLimiter(4);

interface AIDocGeneratorProps {
  submissionId: string;
  messageId?: string;
  savedSessionId?: string;
  template: AIDocTemplate;
  savedSections?: Record<string, AIDocSectionResult>;
  savedDownloadUrl?: string;
}

function fileTypeIcon(fileType: string) {
  switch (fileType) {
    case "pptx":
      return PresentationIcon;
    case "xlsx":
      return TableIcon;
    default:
      return FileTextIcon;
  }
}

function statusIcon(status: DocSectionStatus) {
  switch (status) {
    case "pending":
      return <CircleIcon className="size-3.5 text-muted-foreground" />;
    case "running":
      return <CircleDotIcon className="size-3.5 text-blue-500 animate-pulse" />;
    case "complete":
      return <CheckCircle2Icon className="size-3.5 text-green-500" />;
    case "error":
      return <AlertCircleIcon className="size-3.5 text-red-500" />;
  }
}

export function AIDocGenerator({
  submissionId,
  messageId,
  savedSessionId: initialSessionId,
  template,
  savedSections: initialSections,
  savedDownloadUrl: initialDownloadUrl,
}: AIDocGeneratorProps) {
  const t = useTranslations("docs");
  const [sections, setSections] = useState<Record<string, AIDocSectionResult>>(() => {
    if (initialSections && Object.keys(initialSections).length > 0) return initialSections;
    const init: Record<string, AIDocSectionResult> = {};
    for (const s of template.sections) {
      init[s.id] = { sectionId: s.id, status: "pending" };
    }
    return init;
  });
  const [fileStatus, setFileStatus] = useState<"idle" | "generating" | "ready" | "error">(
    initialDownloadUrl ? "ready" : "idle",
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(initialDownloadUrl ?? null);
  const [pendingSave, setPendingSave] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(!!initialSessionId);
  const sessionIdRef = useRef<string | undefined>(initialSessionId);

  const completedCount = Object.values(sections).filter((s) => s.status === "complete").length;
  const erroredCount = Object.values(sections).filter((s) => s.status === "error").length;
  const totalCount = template.sections.length;
  const allComplete = completedCount === totalCount;

  const FileIcon = fileTypeIcon(template.fileType);

  const executeSingleSection = useCallback(
    async (sectionDef: (typeof template.sections)[number]) => {
      setSections((prev) => ({
        ...prev,
        [sectionDef.id]: { sectionId: sectionDef.id, status: "running" },
      }));
      try {
        const result = await limiter(() =>
          trpc.docs.executeSection.mutate({
            submissionId,
            section: sectionDef,
          }),
        );
        setSections((prev) => ({
          ...prev,
          [sectionDef.id]: {
            sectionId: sectionDef.id,
            status: "complete",
            content: result.content,
            usage: result.usage,
            latencyMs: result.latencyMs,
          },
        }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Execution failed";
        setSections((prev) => ({
          ...prev,
          [sectionDef.id]: {
            sectionId: sectionDef.id,
            status: "error",
            error: message,
          },
        }));
      }
    },
    [submissionId],
  );

  const runAll = useCallback(async () => {
    const promises = template.sections.map((s) => executeSingleSection(s));
    await Promise.allSettled(promises);
    setPendingSave(true);
  }, [template.sections, executeSingleSection]);

  const handleRetrySection = useCallback(
    async (sectionDef: (typeof template.sections)[number]) => {
      await executeSingleSection(sectionDef);
      setPendingSave(true);
    },
    [executeSingleSection],
  );

  const handleRetryAllFailed = useCallback(async () => {
    const failedSections = template.sections.filter(
      (s) => sections[s.id]?.status === "error",
    );
    const promises = failedSections.map((s) => executeSingleSection(s));
    await Promise.allSettled(promises);
    setPendingSave(true);
  }, [template.sections, sections, executeSingleSection]);

  // Auto-run on mount
  const hasRun = useRef(false);
  const hasSavedSections = useRef(!!initialSections && Object.keys(initialSections).length > 0);
  const runAllRef = useRef(runAll);
  runAllRef.current = runAll;
  useEffect(() => {
    if (hasSavedSections.current) return;
    if (!hasRun.current && template.sections.length > 0) {
      hasRun.current = true;
      runAllRef.current();
    }
  }, [template.sections.length]);

  // Effect-based save
  useEffect(() => {
    if (!pendingSave) return;
    setPendingSave(false);
    (async () => {
      try {
        const session = await trpc.docs.saveSession.mutate({
          id: sessionIdRef.current,
          submissionId,
          messageId,
          template: template as unknown as Record<string, unknown>,
          sections,
          fileType: template.fileType,
        });
        sessionIdRef.current = session.id;
        setSessionSaved(true);

        // Update message metadata with session ID
        if (messageId && session?.id) {
          try {
            await trpc.chat.updateMessageMetadata.mutate({
              messageId,
              docSessionId: session.id,
            });
          } catch { /* non-critical */ }
        }
      } catch { /* non-critical */ }
    })();
  }, [pendingSave, sections, submissionId, messageId, template]);

  // Auto-generate file when all sections complete
  useEffect(() => {
    if (!allComplete || fileStatus !== "idle" || !sessionIdRef.current) return;
    generateAndDownload();
  }, [allComplete, fileStatus, sessionSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  const generatingRef = useRef(false);

  const generateAndDownload = useCallback(async () => {
    if (!sessionIdRef.current || generatingRef.current) return;
    generatingRef.current = true;
    setFileStatus("generating");
    try {
      await Promise.race([
        trpc.docs.generateFile.mutate({ sessionId: sessionIdRef.current }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("File generation timed out")), 120_000),
        ),
      ]);
      const { url, filename } = await trpc.docs.getDownloadUrl.query({
        sessionId: sessionIdRef.current,
      });
      setDownloadUrl(url);
      setFileStatus("ready");

      // Auto-download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setFileStatus("error");
    } finally {
      generatingRef.current = false;
    }
  }, []);

  return (
    <div className="my-2 space-y-3 rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileIcon className="size-4 text-primary" />
        <span className="text-sm font-medium">{template.name}</span>
        <Badge variant="outline" className="text-[9px] uppercase">
          {template.fileType}
        </Badge>
      </div>
      {template.description && (
        <p className="text-xs text-muted-foreground">{template.description}</p>
      )}

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {t("sectionsComplete", { count: completedCount, total: totalCount })}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Section status list */}
      <div className="space-y-1">
        {template.sections.map((sectionDef) => {
          const result = sections[sectionDef.id];
          const status = result?.status ?? "pending";
          return (
            <div
              key={sectionDef.id}
              className="flex items-center gap-2 text-xs"
            >
              {statusIcon(status)}
              <span className={cn(
                status === "complete" && "text-muted-foreground",
                status === "error" && "text-red-500",
              )}>
                {sectionDef.name}
              </span>
              {result?.error && (
                <span className="text-[10px] text-red-400 truncate max-w-[200px]">
                  {result.error}
                </span>
              )}
              {status === "error" && (
                <button
                  type="button"
                  onClick={() => handleRetrySection(sectionDef)}
                  className="ml-auto flex cursor-pointer items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted"
                  title={t("retrySection")}
                >
                  <RefreshCwIcon className="size-2.5" />
                  {t("retrySection")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Retry all failed */}
      {erroredCount > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/30">
          <AlertCircleIcon className="size-3.5 text-red-500" />
          <span className="text-xs text-red-500">
            {t("sectionsFailed", { count: erroredCount })}
          </span>
          <button
            type="button"
            onClick={handleRetryAllFailed}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted transition-colors"
          >
            <RefreshCwIcon className="size-3" />
            {t("retryAllFailed")}
          </button>
        </div>
      )}

      {/* File generation status */}
      {allComplete && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/30">
          {fileStatus === "generating" && (
            <>
              <Loader2Icon className="size-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{t("generatingFile")}</span>
            </>
          )}
          {fileStatus === "ready" && downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <DownloadIcon className="size-3.5" />
              {t("download")}
            </a>
          )}
          {fileStatus === "error" && (
            <>
              <AlertCircleIcon className="size-4 text-red-500" />
              <span className="text-xs text-red-500">{t("fileGenerationError")}</span>
              <button
                type="button"
                onClick={generateAndDownload}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted transition-colors"
              >
                <RefreshCwIcon className="size-3" />
                {t("retry")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
