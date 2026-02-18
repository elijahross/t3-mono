"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { getViewState } from "@/lib/view-state";
import { useCommandIsland } from "@/lib/command-island-context";
import { MessageList } from "@/components/chat/MessageList";
import { SparklesIcon } from "lucide-react";
import type { TablesOrchestrationResult, TableConfig, AITableCell, AITableColumnDef } from "@/lib/ai-table-types";
import type { DocsOrchestrationResult, DocConfig, AIDocTemplate, AIDocSectionResult } from "@/lib/ai-doc-types";

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
}

interface ChatPanelProps {
  submissionId?: string | null;
  initialMessage?: string;
  tablesPrompt?: string;
  docsPrompt?: string;
}

/** Coerce server messages (metadata: JsonValue) to local Message shape */
function toMessages(msgs: { id: string; role: string; content: string; createdAt: Date | string; metadata?: unknown }[]): Message[] {
  return msgs.map((m) => ({
    ...m,
    metadata: m.metadata != null && typeof m.metadata === "object" && !Array.isArray(m.metadata)
      ? (m.metadata as Record<string, unknown>)
      : undefined,
  }));
}

export function ChatPanel({ submissionId, initialMessage, tablesPrompt, docsPrompt }: ChatPanelProps) {
  const t = useTranslations("chat");
  const cmdCtx = useCommandIsland();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const tablesPromptSent = useRef(false);
  const docsPromptSent = useRef(false);
  const [inlineTables, setInlineTables] = useState<Record<string, TableConfig[]>>({});
  const [inlineDocs, setInlineDocs] = useState<Record<string, DocConfig[]>>({});

  const handleAddTable = useCallback((messageId: string, config: TableConfig) => {
    setInlineTables((prev) => {
      const existing = prev[messageId] ?? [];
      if (existing.some((t) => t.id === config.id)) return prev;
      return { ...prev, [messageId]: [...existing, config] };
    });
  }, []);

  const handleAddDoc = useCallback((messageId: string, config: DocConfig) => {
    setInlineDocs((prev) => {
      const existing = prev[messageId] ?? [];
      if (existing.some((d) => d.id === config.id)) return prev;
      return { ...prev, [messageId]: [...existing, config] };
    });
  }, []);

  // Hydrate saved table sessions from message metadata
  const hydrateInlineTables = useCallback(async (msgs: Message[]) => {
    const tables: Record<string, TableConfig[]> = {};
    const sessionPromises: Promise<void>[] = [];

    for (const msg of msgs) {
      const sessionIds = msg.metadata?.tableSessionIds as string[] | undefined;
      if (!sessionIds?.length) continue;

      for (const sessionId of sessionIds) {
        sessionPromises.push(
          trpc.tables.loadSession
            .query({ id: sessionId })
            .then((session) => {
              if (!session) return;
              const useCase = session.useCase as unknown as import("@/lib/ai-table-types").AITableUseCase;
              const columns = session.columns as unknown as AITableColumnDef[];
              const cells = session.results as unknown as Record<string, AITableCell>;
              const orchestration = msg.metadata?.tablesOrchestration as TablesOrchestrationResult | undefined;
              const rows = orchestration?.inputDocuments ?? [];
              const config: TableConfig = {
                id: useCase.id,
                useCase,
                rows,
                submissionId: session.submissionId,
                savedSessionId: session.id,
                savedColumns: columns,
                savedCells: cells,
              };
              if (!tables[msg.id]) tables[msg.id] = [];
              tables[msg.id].push(config);
            })
            .catch(() => {
              // Skip failed session loads
            }),
        );
      }
    }

    await Promise.all(sessionPromises);
    if (Object.keys(tables).length > 0) {
      setInlineTables(tables);
    }
  }, []);

  // Hydrate saved doc sessions from message metadata
  const hydrateInlineDocs = useCallback(async (msgs: Message[]) => {
    const docs: Record<string, DocConfig[]> = {};
    const sessionPromises: Promise<void>[] = [];

    for (const msg of msgs) {
      const sessionIds = msg.metadata?.docSessionIds as string[] | undefined;
      if (!sessionIds?.length) continue;

      for (const sessionId of sessionIds) {
        sessionPromises.push(
          trpc.docs.loadSession
            .query({ id: sessionId })
            .then(async (session) => {
              if (!session) return;
              const template = session.template as unknown as AIDocTemplate;
              const sections = session.sections as unknown as Record<string, AIDocSectionResult>;
              const config: DocConfig = {
                id: template.id,
                template,
                submissionId: session.submissionId,
                savedSessionId: session.id,
                savedSections: sections,
              };
              // Fetch signed download URL for completed sessions
              if (session.status === "complete" && session.s3Key) {
                try {
                  const { url } = await trpc.docs.getDownloadUrl.query({ sessionId: session.id });
                  config.savedDownloadUrl = url;
                } catch {
                  // Non-critical — user can still re-generate
                }
              }
              if (!docs[msg.id]) docs[msg.id] = [];
              docs[msg.id].push(config);
            })
            .catch(() => {
              // Skip failed session loads
            }),
        );
      }
    }

    await Promise.all(sessionPromises);
    if (Object.keys(docs).length > 0) {
      setInlineDocs(docs);
    }
  }, []);

  // Initialize thread
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // Use existing threadId from context if available
        if (cmdCtx.currentThreadId && !submissionId) {
          const existingId = cmdCtx.currentThreadId;
          const msgs = await trpc.chat.getMessages.query({ threadId: existingId });
          if (cancelled) return;
          setThreadId(existingId);
          const converted = toMessages(msgs);
          setMessages(converted);
          hydrateInlineTables(converted);
          hydrateInlineDocs(converted);
          setInitialized(true);
          return;
        }

        const thread = await trpc.chat.getOrCreateThread.mutate({
          submissionId: submissionId ?? undefined,
        });
        if (cancelled) return;
        setThreadId(thread.id);
        cmdCtx.setCurrentThreadId(thread.id);

        // Load existing messages
        const msgs = await trpc.chat.getMessages.query({
          threadId: thread.id,
        });
        if (cancelled) return;
        const converted = toMessages(msgs);
        setMessages(converted);
        hydrateInlineTables(converted);
        hydrateInlineDocs(converted);
        setInitialized(true);
      } catch {
        // ignore
        setInitialized(true);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [submissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send initial message once thread is ready
  useEffect(() => {
    if (!initialized || !threadId || !initialMessage) return;
    // Only send if there are no messages yet (fresh thread)
    if (messages.length > 0) return;
    handleSend(initialMessage);
  }, [initialized, threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reusable tables orchestration handler
  const handleTablesOrchestrate = useCallback(
    (prompt: string) => {
      if (!submissionId) return;

      const tempUserId = `tables-user-${Date.now()}`;
      const userMsg: Message = {
        id: tempUserId,
        role: "user",
        content: prompt,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      trpc.tables.orchestrate
        .mutate({ submissionId, prompt })
        .then(async (result: TablesOrchestrationResult) => {
          const tempAssistId = `tables-assist-${Date.now()}`;
          const assistantContent = `**${result.taskTitle}**\n\n${result.taskDescription}`;
          const assistantMsg: Message = {
            id: tempAssistId,
            role: "assistant",
            content: assistantContent,
            createdAt: new Date(),
            metadata: { tablesOrchestration: result },
          };
          setMessages((prev) => [...prev, assistantMsg]);

          // Persist to DB if we have a thread
          if (threadId) {
            try {
              const saved = await trpc.tables.saveOrchestrationMessage.mutate({
                threadId,
                userContent: prompt,
                assistantContent,
                orchestrationResult: result,
              });
              // Replace ephemeral IDs with real DB IDs
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === tempUserId)
                    return { ...m, id: saved.userMessage.id, createdAt: saved.userMessage.createdAt };
                  if (m.id === tempAssistId)
                    return { ...m, id: saved.assistantMessage.id, createdAt: saved.assistantMessage.createdAt };
                  return m;
                }),
              );
            } catch {
              // Persistence failure is non-critical
            }
          }
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Unknown error";
          const errorMsg: Message = {
            id: `tables-error-${Date.now()}`,
            role: "assistant",
            content: `Failed to orchestrate tables analysis: ${message}`,
            createdAt: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [submissionId, threadId],
  );

  // Handle tables orchestration prompt on mount
  useEffect(() => {
    if (!initialized || !tablesPrompt || tablesPromptSent.current) return;
    if (!submissionId) return;
    tablesPromptSent.current = true;
    handleTablesOrchestrate(tablesPrompt);
  }, [initialized, tablesPrompt, submissionId, handleTablesOrchestrate]);

  // Reusable docs orchestration handler
  const handleDocsOrchestrate = useCallback(
    (prompt: string) => {
      if (!submissionId) return;

      const tempUserId = `docs-user-${Date.now()}`;
      const userMsg: Message = {
        id: tempUserId,
        role: "user",
        content: prompt,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      trpc.docs.orchestrate
        .mutate({ submissionId, prompt })
        .then(async (result: DocsOrchestrationResult) => {
          const tempAssistId = `docs-assist-${Date.now()}`;
          const assistantContent = `**${result.taskTitle}**\n\n${result.taskDescription}`;
          const assistantMsg: Message = {
            id: tempAssistId,
            role: "assistant",
            content: assistantContent,
            createdAt: new Date(),
            metadata: { docsOrchestration: result },
          };
          setMessages((prev) => [...prev, assistantMsg]);

          if (threadId) {
            try {
              const saved = await trpc.docs.saveOrchestrationMessage.mutate({
                threadId,
                userContent: prompt,
                assistantContent,
                orchestrationResult: result,
              });
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === tempUserId)
                    return { ...m, id: saved.userMessage.id, createdAt: saved.userMessage.createdAt };
                  if (m.id === tempAssistId)
                    return { ...m, id: saved.assistantMessage.id, createdAt: saved.assistantMessage.createdAt };
                  return m;
                }),
              );
            } catch {
              // Persistence failure is non-critical
            }
          }
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Unknown error";
          const errorMsg: Message = {
            id: `docs-error-${Date.now()}`,
            role: "assistant",
            content: `Failed to orchestrate document generation: ${message}`,
            createdAt: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [submissionId, threadId],
  );

  // Handle docs orchestration prompt on mount
  useEffect(() => {
    if (!initialized || !docsPrompt || docsPromptSent.current) return;
    if (!submissionId) return;
    docsPromptSent.current = true;
    handleDocsOrchestrate(docsPrompt);
  }, [initialized, docsPrompt, submissionId, handleDocsOrchestrate]);

  const handleSend = useCallback(
    async (content: string, attachmentIds?: string[]) => {
      if (!threadId || isLoading) return;

      // Optimistic user message
      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        role: "user",
        content,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setIsLoading(true);

      try {
        const viewContext = getViewState();
        const result = await trpc.chat.sendMessage.mutate({
          threadId,
          content,
          viewContext,
          attachmentIds: attachmentIds?.length ? attachmentIds : undefined,
        });

        // Replace optimistic message and add assistant response
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          ...toMessages([result.userMessage, result.assistantMessage]),
        ]);
      } catch {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, isLoading],
  );

  const handleFollowUp = useCallback((suggestion: string) => {
    handleSend(suggestion);
  }, [handleSend]);

  // Register handleSend so the CommandIsland can send messages to the active chat
  useEffect(() => {
    if (!threadId) return;
    cmdCtx.setChatSendMessage(() => (msg: string, attachmentIds?: string[]) => {
      handleSend(msg, attachmentIds);
    });
    return () => cmdCtx.setChatSendMessage(null);
  }, [threadId, handleSend]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register handleTablesOrchestrate so TablesWiring can send orchestration to this chat
  useEffect(() => {
    if (!threadId) return;
    cmdCtx.setChatTablesOrchestrate(() => (prompt: string) => {
      handleTablesOrchestrate(prompt);
    });
    return () => cmdCtx.setChatTablesOrchestrate(null);
  }, [threadId, handleTablesOrchestrate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register handleDocsOrchestrate so DocsWiring can send orchestration to this chat
  useEffect(() => {
    if (!threadId) return;
    cmdCtx.setChatDocsOrchestrate(() => (prompt: string) => {
      handleDocsOrchestrate(prompt);
    });
    return () => cmdCtx.setChatDocsOrchestrate(null);
  }, [threadId, handleDocsOrchestrate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
      {/* Messages */}
      {messages.length === 0 && !isLoading ? (
        <div className="flex flex-1 min-h-max flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <SparklesIcon className="size-5 text-primary" />
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("welcomeMessage")}
          </p>
        </div>
      ) : (
        <MessageList
          messages={messages}
          isLoading={isLoading}
          inlineTables={inlineTables}
          onAddTable={handleAddTable}
          inlineDocs={inlineDocs}
          onAddDoc={handleAddDoc}
          onFollowUp={handleFollowUp}
        />
      )}
    </div>
  );
}
