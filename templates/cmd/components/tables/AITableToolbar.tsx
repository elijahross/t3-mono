"use client";

import { useTranslations } from "next-intl";
import { DownloadIcon } from "lucide-react";
import type { AITableState } from "@/lib/ai-table-types";

interface AITableToolbarProps {
  title: string;
  description: string;
  state: AITableState;
  onExport: () => void;
}

export function AITableToolbar({
  title,
  description,
  state,
  onExport,
}: AITableToolbarProps) {
  const t = useTranslations("tables");

  const totalCells = state.rows.length * state.columns.length;
  const completedCells = Object.values(state.cells).filter(
    (c) => c.status === "complete",
  ).length;
  const hasResults = completedCells > 0;
  const progress = totalCells > 0 ? (completedCells / totalCells) * 100 : 0;

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4 py-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        <p className="truncate text-[11px] text-muted-foreground">
          {description}
        </p>
        {totalCells > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-border/50">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {t("cellsComplete", {
                count: completedCells,
                total: totalCells,
              })}
            </span>
          </div>
        )}
      </div>
      {hasResults && (
        <button
          type="button"
          onClick={onExport}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title={t("export")}
        >
          <DownloadIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
