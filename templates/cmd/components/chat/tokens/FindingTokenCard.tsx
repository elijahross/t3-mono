"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSplitView } from "@/lib/split-view-context";
import { FindingDetailContent } from "@/components/ppap/FindingDetailContent";
import { setViewState } from "@/lib/view-state";

interface FindingTokenCardProps {
  findingId: string;
}

const severityColors: Record<string, string> = {
  BLOCKER: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  MAJOR: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  MINOR: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  OBSERVATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function FindingTokenCard({ findingId }: FindingTokenCardProps) {
  const t = useTranslations("chat");
  const { openOverlay } = useSplitView();
  const [finding, setFinding] = useState<{
    id: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    evidencePointers: any;
    suggestedFix: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    trpc.report.getFindingById
      .query({ findingId })
      .then(setFinding)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [findingId]);

  if (loading) return <Skeleton className="h-14 w-full rounded-lg" />;
  if (error || !finding) {
    return (
      <span className="text-xs text-muted-foreground italic">
        [{t("referenceNotFound")}]
      </span>
    );
  }

  const handleClick = () => {
    setViewState({ findingId: finding.id });
    openOverlay(<FindingDetailContent finding={finding as any} />);
  };

  const truncatedDesc =
    finding.description.length > 120
      ? finding.description.slice(0, 117) + "..."
      : finding.description;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full cursor-pointer rounded-lg border border-border bg-muted/50 p-2.5 text-left transition-colors hover:bg-muted"
    >
      <div className="mb-1 flex items-center gap-2">
        <Badge
          className={`text-[10px] px-1.5 py-0 ${severityColors[finding.severity] ?? ""}`}
        >
          {finding.severity}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {finding.category.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug">{finding.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{truncatedDesc}</p>
    </button>
  );
}
