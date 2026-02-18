"use client";

import React, { memo, useEffect, useMemo, useRef } from "react";
import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { AITable } from "@/components/tables/AITable";
import { TablesUseCaseBadges } from "@/components/tables/TablesUseCaseBadges";
import { DocsTemplateBadges } from "@/components/docs/DocsTemplateBadges";
import { AIDocGenerator } from "@/components/docs/AIDocGenerator";
import { FollowUpSuggestions } from "@/components/chat/FollowUpSuggestions";
import type { TablesOrchestrationResult, TableConfig } from "@/lib/ai-table-types";
import type { DocsOrchestrationResult, DocConfig } from "@/lib/ai-doc-types";

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: Date | string;
  metadata?: any;
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  inlineTables?: Record<string, TableConfig[]>;
  onAddTable?: (messageId: string, config: TableConfig) => void;
  inlineDocs?: Record<string, DocConfig[]>;
  onAddDoc?: (messageId: string, config: DocConfig) => void;
  onFollowUp?: (suggestion: string) => void;
}

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  inlineTables,
  onAddTable,
  inlineDocs,
  onAddDoc,
  onFollowUp,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  // Compute expanded use-case IDs per message for badge dimming
  const expandedByMessage = useMemo(() => {
    if (!inlineTables) return {};
    const result: Record<string, Set<string>> = {};
    for (const [msgId, tables] of Object.entries(inlineTables)) {
      result[msgId] = new Set(tables.map((t) => t.id));
    }
    return result;
  }, [inlineTables]);

  const expandedDocsByMessage = useMemo(() => {
    if (!inlineDocs) return {};
    const result: Record<string, Set<string>> = {};
    for (const [msgId, docs] of Object.entries(inlineDocs)) {
      result[msgId] = new Set(docs.map((d) => d.id));
    }
    return result;
  }, [inlineDocs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg, index) => (
        <React.Fragment key={msg.id}>
          <ChatMessageBubble
            messageId={msg.id}
            role={msg.role as "user" | "assistant"}
            content={msg.content}
            createdAt={msg.createdAt}
            attachments={msg.metadata?.attachments}
          />
          {msg.role === "assistant" && msg.metadata?.tablesOrchestration && (
            <div className="pl-9">
              <TablesUseCaseBadges
                orchestration={msg.metadata.tablesOrchestration as TablesOrchestrationResult}
                messageId={msg.id}
                onAddTable={onAddTable}
                expandedUseCaseIds={expandedByMessage[msg.id]}
              />
            </div>
          )}
          {msg.role === "assistant" && msg.metadata?.docsOrchestration && (
            <div className="pl-9">
              <DocsTemplateBadges
                orchestration={msg.metadata.docsOrchestration as DocsOrchestrationResult}
                messageId={msg.id}
                onAddDoc={onAddDoc}
                expandedTemplateIds={expandedDocsByMessage[msg.id]}
              />
            </div>
          )}
          {msg.role === "assistant" && index === lastAssistantIndex && onFollowUp && (
            <div className="pl-9">
              <FollowUpSuggestions
                messageId={msg.id}
                cachedSuggestions={msg.metadata?.followUpSuggestions as string[] | undefined}
                onSelect={onFollowUp}
              />
            </div>
          )}
          {inlineTables?.[msg.id]?.map((table) => (
            <div key={table.id} className="pl-9">
              <AITable
                submissionId={table.submissionId}
                messageId={msg.id}
                savedSessionId={table.savedSessionId}
                useCase={table.useCase}
                initialColumns={table.savedColumns ?? table.useCase.columns}
                initialRows={table.rows}
                initialCells={table.savedCells}
              />
            </div>
          ))}
          {inlineDocs?.[msg.id]?.map((doc, idx) => (
            <div key={doc.savedSessionId ?? `${doc.id}-${idx}`} className="pl-9">
              <AIDocGenerator
                submissionId={doc.submissionId}
                messageId={msg.id}
                savedSessionId={doc.savedSessionId}
                template={doc.template}
                savedSections={doc.savedSections}
                savedDownloadUrl={doc.savedDownloadUrl}
              />
            </div>
          ))}
        </React.Fragment>
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
});
