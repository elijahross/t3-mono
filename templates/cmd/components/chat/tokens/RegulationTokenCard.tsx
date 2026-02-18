"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpenIcon, TagIcon } from "lucide-react";

interface RegulationTokenCardProps {
  requirementId: string;
}

export function RegulationTokenCard({ requirementId }: RegulationTokenCardProps) {
  const t = useTranslations("chat");
  const [requirement, setRequirement] = useState<{
    id: string;
    title: string;
    description: string;
    section: string | null;
    attributes: any;
    tags: string[];
    filename: string;
    collectionName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    trpc.regulation.getRequirementById
      .query({ requirementId })
      .then(setRequirement)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [requirementId]);

  if (loading) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (error || !requirement) {
    return (
      <span className="text-xs text-muted-foreground italic">
        [{t("referenceNotFound")}]
      </span>
    );
  }

  const truncatedDesc =
    requirement.description.length > 150
      ? requirement.description.slice(0, 147) + "..."
      : requirement.description;

  const attrs = requirement.attributes as Record<string, string[]> | null;
  const hasAttrs = attrs && Object.keys(attrs).length > 0;

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <BookOpenIcon className="size-3 text-primary" />
        <span className="text-[10px] font-medium text-primary">
          {requirement.collectionName}
        </span>
        {requirement.section && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {requirement.section}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground truncate">
          {requirement.filename}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug">{requirement.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {expanded ? requirement.description : truncatedDesc}
      </p>
      {requirement.description.length > 150 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 cursor-pointer text-[10px] font-medium text-primary hover:underline"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
      {(requirement.tags.length > 0 || hasAttrs) && expanded && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {requirement.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {hasAttrs && Object.entries(attrs!).map(([key, values]) => (
            <span key={key} className="text-[10px] text-muted-foreground">
              {key}: {values.join(", ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
