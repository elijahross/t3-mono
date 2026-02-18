"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { useSplitView } from "@/lib/split-view-context";
import { DocumentDetailContent } from "@/components/ppap/DocumentDetailContent";
import { FileTextIcon, TextIcon, TableIcon, ImageIcon } from "lucide-react";

type TokenType = "DOCUMENT" | "CHUNK" | "TABLE" | "IMAGE";

interface ReferenceBadgeProps {
  tokenType: TokenType;
  id: string;
}

interface BadgeMeta {
  documentId: string;
  label: string;
  pageNumber?: number;
  excerpt?: string;
}

const iconMap = {
  DOCUMENT: FileTextIcon,
  CHUNK: TextIcon,
  TABLE: TableIcon,
  IMAGE: ImageIcon,
} as const;

export function ReferenceBadge({ tokenType, id }: ReferenceBadgeProps) {
  const t = useTranslations("chat");
  const { openOverlay } = useSplitView();
  const [meta, setMeta] = useState<BadgeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let result: BadgeMeta;

        switch (tokenType) {
          case "DOCUMENT": {
            const d = await trpc.document.getContent.query({ documentId: id });
            result = { documentId: d.id, label: d.filename };
            break;
          }
          case "CHUNK": {
            const c = await trpc.document.getChunkById.query({ chunkId: id });
            const pageSuffix = c.pageNumber != null ? ` p.${c.pageNumber}` : "";
            result = {
              documentId: c.documentId,
              label: `${c.filename}${pageSuffix}`,
              pageNumber: c.pageNumber ?? undefined,
              excerpt: c.content.slice(0, 80),
            };
            break;
          }
          case "TABLE": {
            const tb = await trpc.document.getTableById.query({ tableId: id });
            result = {
              documentId: tb.documentId,
              label: `${tb.filename} ${tb.rows}\u00d7${tb.columns}`,
              pageNumber: tb.pageNumber ?? undefined,
            };
            break;
          }
          case "IMAGE": {
            const img = await trpc.document.getImageById.query({ imageId: id });
            const imgPage = img.pageNumber != null ? ` p.${img.pageNumber}` : "";
            result = {
              documentId: img.documentId,
              label: `${img.filename}${imgPage}`,
              pageNumber: img.pageNumber ?? undefined,
            };
            break;
          }
        }

        if (!cancelled) setMeta(result);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tokenType, id]);

  if (loading) return <span className="bg-muted animate-pulse inline-block h-5 w-24 rounded-full" />;
  if (error || !meta) {
    return (
      <span className="text-xs text-muted-foreground italic">
        [{t("referenceNotFound")}]
      </span>
    );
  }

  const Icon = iconMap[tokenType];

  const ariaMap = {
    DOCUMENT: "viewDocument",
    CHUNK: "viewDocument",
    TABLE: "viewTable",
    IMAGE: "viewImage",
  } as const;

  const handleClick = () => {
    openOverlay(
      <DocumentDetailContent
        documentId={meta.documentId}
        pageNumber={meta.pageNumber}
        excerpt={meta.excerpt}
      />,
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center align-baseline"
      aria-label={t(ariaMap[tokenType])}
    >
      <Badge variant="outline" className="max-w-40 cursor-pointer gap-1 text-[11px]">
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{meta.label}</span>
      </Badge>
    </button>
  );
}
