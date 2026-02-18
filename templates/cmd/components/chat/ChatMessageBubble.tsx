"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { SparklesIcon, UserIcon, PaperclipIcon } from "lucide-react";

interface ChatMessageBubbleProps {
  messageId?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date | string;
  attachments?: { filename: string }[];
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  messageId,
  role,
  content,
  createdAt,
  attachments,
}: ChatMessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? (
          <UserIcon className="size-3.5" />
        ) : (
          <SparklesIcon className="size-3.5" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <ChatMarkdown content={content} />
        )}
        {isUser && attachments && attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {attachments.map((a) => (
              <span
                key={a.filename}
                className="inline-flex items-center gap-1 rounded-full border border-primary-foreground/20 px-2 py-0.5 text-[10px] text-primary-foreground/80"
              >
                <PaperclipIcon className="size-2.5" />
                {a.filename}
              </span>
            ))}
          </div>
        )}
        {createdAt && (
          <p
            className={cn(
              "mt-1 text-[10px]",
              isUser ? "text-primary-foreground/60" : "text-muted-foreground",
            )}
          >
            {new Date(createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
});
