"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ChunkTokenCardProps {
  chunkId: string;
}

export function ChunkTokenCard({ chunkId }: ChunkTokenCardProps) {
  const t = useTranslations("chat");
  const [chunk, setChunk] = useState<{
    content: string;
    chunkIndex: number;
    pageNumber: number | null;
    sheetName: string | null;
    chunkType: string;
    filename: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    trpc.document.getChunkById
      .query({ chunkId })
      .then(setChunk)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [chunkId]);

  if (loading) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (error || !chunk) {
    return (
      <span className="text-xs text-muted-foreground italic">
        [{t("referenceNotFound")}]
      </span>
    );
  }

  const preview = chunk.content.slice(0, 100);
  const hasMore = chunk.content.length > 100;

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        {chunk.pageNumber != null && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {t("pageLabel")} {chunk.pageNumber}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {chunk.chunkType}
        </Badge>
        <span className="text-[10px] text-muted-foreground truncate">
          {chunk.filename}
        </span>
      </div>
      <pre className="whitespace-pre-wrap text-xs leading-relaxed">
        {expanded ? chunk.content : preview}
        {hasMore && !expanded && "..."}
      </pre>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 cursor-pointer text-[10px] font-medium text-primary hover:underline"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </div>
  );
}
