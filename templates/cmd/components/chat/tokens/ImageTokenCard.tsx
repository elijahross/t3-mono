"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageTokenCardProps {
  imageId: string;
}

export function ImageTokenCard({ imageId }: ImageTokenCardProps) {
  const t = useTranslations("chat");
  const [image, setImage] = useState<{
    presignedUrl?: string;
    width: number | null;
    height: number | null;
    description: string | null;
    pageNumber: number | null;
    format: string | null;
    filename: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    trpc.document.getImageById
      .query({ imageId })
      .then(setImage)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [imageId]);

  if (loading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (error || !image) {
    return (
      <span className="text-xs text-muted-foreground italic">
        [{t("referenceNotFound")}]
      </span>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-2.5">
      <div className="flex items-center gap-1.5">
        {image.pageNumber != null && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {t("pageLabel")} {image.pageNumber}
          </Badge>
        )}
        {image.format && (
          <span className="text-[10px] text-muted-foreground uppercase">
            {image.format}
          </span>
        )}
        {image.width && image.height && (
          <span className="text-[10px] text-muted-foreground">
            {image.width}&times;{image.height}
          </span>
        )}
      </div>
      {image.presignedUrl && (
        <img
          src={image.presignedUrl}
          alt={image.description || "Document image"}
          className="max-w-full rounded border border-border"
          style={{ maxHeight: 300 }}
        />
      )}
      {image.description && (
        <p className="text-[10px] text-muted-foreground italic">
          {image.description}
        </p>
      )}
    </div>
  );
}
