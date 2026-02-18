"use client";

import { useEffect, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface FollowUpSuggestionsProps {
  messageId: string;
  cachedSuggestions?: string[];
  onSelect: (suggestion: string) => void;
}

export function FollowUpSuggestions({ messageId, cachedSuggestions, onSelect }: FollowUpSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>(cachedSuggestions ?? []);

  useEffect(() => {
    if (suggestions.length > 0) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const result = await trpc.chat.getFollowUpSuggestions.query({ messageId });
        if (result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
          clearInterval(interval);
        }
      } catch { /* ignore */ }
      if (attempts >= 3) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [messageId, suggestions.length]);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <button key={s} type="button" onClick={() => onSelect(s)} className="cursor-pointer">
          <Badge variant="secondary" className="gap-1 text-[11px] hover:bg-primary/10 hover:text-primary transition-colors">
            <SparklesIcon className="size-2.5" />
            {s}
          </Badge>
        </button>
      ))}
    </div>
  );
}
