"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseContent } from "@/lib/chat-tokens";
import { TokenRenderer } from "@/components/chat/TokenRenderer";

function processChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.toArray(children).flatMap((child, ci): React.ReactElement[] => {
    if (typeof child !== "string") {
      return [<React.Fragment key={`c-${ci}`}>{child}</React.Fragment>];
    }
    const segments = parseContent(child);
    if (segments.length === 1 && segments[0].kind === "text") {
      return [<React.Fragment key={`t-${ci}`}>{child}</React.Fragment>];
    }
    return segments.map((seg, i) =>
      seg.kind === "token" && seg.token ? (
        <TokenRenderer key={`tok-${ci}-${i}`} token={seg.token} />
      ) : (
        <React.Fragment key={`txt-${ci}-${i}`}>{seg.value}</React.Fragment>
      ),
    );
  });
}

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-4 last:mb-0">{processChildren(children)}</p>,
          h1: ({ children }) => <h1 className="mb-3 mt-5 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-4 first:mt-0">{children}</h4>,
          hr: () => <hr className="my-5 border-border" />,
          ul: ({ children }) => <ul className="mb-4 list-disc pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 list-decimal pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-1 last:mb-0">{processChildren(children)}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-border pl-4 text-muted-foreground">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-md bg-muted/50 p-3 last:mb-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-md border border-border last:mb-0">
              <table className="m-0 w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-border last:border-b-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              {processChildren(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-left">
              {processChildren(children)}
            </td>
          ),
          strong: ({ children }) => <strong>{processChildren(children)}</strong>,
          em: ({ children }) => <em>{processChildren(children)}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
