"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileTextIcon, DownloadIcon } from "lucide-react";

interface DocumentTokenCardProps {
  documentId: string;
}

export function DocumentTokenCard({ documentId }: DocumentTokenCardProps) {
  const t = useTranslations("chat");
  const [doc, setDoc] = useState<{ id: string; filename: string; documentType: string | null; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    trpc.document.getContent
      .query({ documentId })
      .then((d) => setDoc({ id: d.id, filename: d.filename, documentType: d.documentType, mimeType: d.mimeType }))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleDownload = async () => {
    try {
      const { downloadUrl } = await trpc.document.getDownloadUrl.query({ documentId });
      window.open(downloadUrl, "_blank");
    } catch {
      // ignore
    }
  };

  if (loading) return <Skeleton className="h-12 w-full rounded-lg" />;
  if (error || !doc) {
    return (
      <span className="text-xs text-muted-foreground italic">
        [{t("referenceNotFound")}]
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2">
      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.filename}</p>
        {doc.documentType && (
          <Badge variant="secondary" className="mt-0.5 text-[10px]">
            {doc.documentType}
          </Badge>
        )}
      </div>
      <Button variant="ghost" size="icon-xs" onClick={handleDownload}>
        <DownloadIcon className="size-3.5" />
      </Button>
    </div>
  );
}
