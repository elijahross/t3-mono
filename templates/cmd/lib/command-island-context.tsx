"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type CommandIslandMode = "query" | "ai" | "tables" | "docs";

interface CommandIslandContextValue {
  query: string;
  setQuery: (q: string) => void;
  mode: CommandIslandMode;
  setMode: (m: CommandIslandMode) => void;
  placeholder: string;
  setPlaceholder: (p: string) => void;
  hasQueryConsumer: boolean;
  setHasQueryConsumer: (v: boolean) => void;
  onAiSubmit: ((message: string, attachmentIds?: string[]) => void) | null;
  setOnAiSubmit: (cb: ((message: string, attachmentIds?: string[]) => void) | null) => void;
  onTablesSubmit: ((prompt: string) => void) | null;
  setOnTablesSubmit: (cb: ((prompt: string) => void) | null) => void;
  onDocsSubmit: ((prompt: string) => void) | null;
  setOnDocsSubmit: (cb: ((prompt: string) => void) | null) => void;
  currentSubmissionId: string | null;
  setCurrentSubmissionId: (id: string | null) => void;
  currentThreadId: string | null;
  setCurrentThreadId: (id: string | null) => void;
  /** Registered by ChatPanel so external callers can send messages to the active chat */
  chatSendMessage: ((message: string, attachmentIds?: string[]) => void) | null;
  setChatSendMessage: (cb: ((message: string, attachmentIds?: string[]) => void) | null) => void;
  /** Registered by ChatPanel so TablesWiring can send orchestration prompts to an already-open chat */
  chatTablesOrchestrate: ((prompt: string) => void) | null;
  setChatTablesOrchestrate: (cb: ((prompt: string) => void) | null) => void;
  /** Registered by ChatPanel so DocsWiring can send orchestration prompts to an already-open chat */
  chatDocsOrchestrate: ((prompt: string) => void) | null;
  setChatDocsOrchestrate: (cb: ((prompt: string) => void) | null) => void;
}

const CommandIslandContext = createContext<CommandIslandContextValue | null>(null);

export function CommandIslandProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<CommandIslandMode>("query");
  const [placeholder, setPlaceholder] = useState("");
  const [hasQueryConsumer, setHasQueryConsumer] = useState(false);
  const [onAiSubmit, setOnAiSubmit] = useState<((message: string, attachmentIds?: string[]) => void) | null>(null);
  const [onTablesSubmit, setOnTablesSubmit] = useState<((prompt: string) => void) | null>(null);
  const [onDocsSubmit, setOnDocsSubmit] = useState<((prompt: string) => void) | null>(null);
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [chatSendMessage, setChatSendMessage] = useState<((message: string, attachmentIds?: string[]) => void) | null>(null);
  const [chatTablesOrchestrate, setChatTablesOrchestrate] = useState<((prompt: string) => void) | null>(null);
  const [chatDocsOrchestrate, setChatDocsOrchestrate] = useState<((prompt: string) => void) | null>(null);

  // Reset on pathname change — only clear user input state.
  // hasQueryConsumer and placeholder are managed by useCommandIslandConsumer lifecycle.
  useEffect(() => {
    setQuery("");
    setMode("query");
    setCurrentSubmissionId(null);
    setCurrentThreadId(null);
  }, [pathname]);

  return (
    <CommandIslandContext.Provider
      value={{
        query,
        setQuery,
        mode,
        setMode,
        placeholder,
        setPlaceholder,
        hasQueryConsumer,
        setHasQueryConsumer,
        onAiSubmit,
        setOnAiSubmit,
        onTablesSubmit,
        setOnTablesSubmit,
        onDocsSubmit,
        setOnDocsSubmit,
        currentSubmissionId,
        setCurrentSubmissionId,
        currentThreadId,
        setCurrentThreadId,
        chatSendMessage,
        setChatSendMessage,
        chatTablesOrchestrate,
        setChatTablesOrchestrate,
        chatDocsOrchestrate,
        setChatDocsOrchestrate,
      }}
    >
      {children}
    </CommandIslandContext.Provider>
  );
}

export function useCommandIsland() {
  const ctx = useContext(CommandIslandContext);
  if (!ctx) throw new Error("useCommandIsland must be used within CommandIslandProvider");
  return ctx;
}

export function useCommandIslandConsumer(placeholder: string) {
  const ctx = useCommandIsland();

  const register = useCallback(() => {
    ctx.setHasQueryConsumer(true);
    ctx.setPlaceholder(placeholder);
  }, [placeholder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    register();
    return () => {
      ctx.setHasQueryConsumer(false);
      ctx.setPlaceholder("");
    };
  }, [register]); // eslint-disable-line react-hooks/exhaustive-deps

  return ctx.query;
}
