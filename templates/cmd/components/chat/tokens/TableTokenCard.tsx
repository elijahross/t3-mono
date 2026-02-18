"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface TableTokenCardProps {
  tableId: string;
}

export function TableTokenCard({ tableId }: TableTokenCardProps) {
  const t = useTranslations("chat");
  const [table, setTable] = useState<{
    rows: number;
    columns: number;
    markdownContent: string;
    contentGrid: any;
    description: string | null;
    pageNumber: number | null;
    filename: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    trpc.document.getTableById
      .query({ tableId })
      .then(setTable)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tableId]);

  if (loading) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (error || !table) {
    return (
      <span className="text-xs text-muted-foreground italic">
        [{t("referenceNotFound")}]
      </span>
    );
  }

  const grid = table.contentGrid as string[][] | null;

  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-2.5">
      <div className="flex items-center gap-1.5">
        {table.pageNumber != null && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {t("pageLabel")} {table.pageNumber}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">
          {table.rows}&times;{table.columns}
        </span>
        <span className="text-[10px] text-muted-foreground truncate">
          {table.filename}
        </span>
      </div>
      {grid && grid.length > 0 ? (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead>
              {grid[0] && (
                <tr className="bg-muted/50">
                  {grid[0].map((cell, ci) => (
                    <th
                      key={ci}
                      className="border-b border-r border-border px-2 py-1 text-left font-medium last:border-r-0"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {grid.slice(1).map((row, ri) => (
                <tr key={ri} className="even:bg-muted/25">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-b border-r border-border px-2 py-1 last:border-r-0"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap rounded border border-border bg-muted/50 p-2 text-xs">
          {table.markdownContent}
        </pre>
      )}
      {table.description && (
        <p className="text-[10px] text-muted-foreground italic">
          {table.description}
        </p>
      )}
    </div>
  );
}
