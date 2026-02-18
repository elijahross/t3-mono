"use client";

import { useTranslations } from "next-intl";
import { FileTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvidencePointer } from "@/components/ppap/EvidencePointer";
import type { AITableCell, AITableColumnDef, AITableRow } from "@/lib/ai-table-types";

interface AITableCellDetailProps {
  cell: AITableCell;
  row: AITableRow;
  column: AITableColumnDef;
}

export function AITableCellDetail({
  cell,
  row,
  column,
}: AITableCellDetailProps) {
  const t = useTranslations("tables");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{column.name}</h3>
        <p className="text-xs text-muted-foreground">{column.description}</p>
      </div>

      {/* Document reference */}
      <div className="flex items-center gap-2">
        <FileTextIcon className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium">{row.filename}</span>
        {row.documentType && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {row.documentType}
          </Badge>
        )}
      </div>

      {/* Answer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-medium text-muted-foreground">{t("answer")}</p>
        <p className="text-sm font-semibold">{cell.result}</p>
      </div>

      {/* Detail / Explanation */}
      {cell.detail && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t("explanation")}</p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed">{cell.detail}</p>
        </div>
      )}

      {/* Source text excerpt */}
      {cell.sourceText && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t("sourceReference")}</p>
          <p className="text-xs italic leading-relaxed">&ldquo;{cell.sourceText}&rdquo;</p>
        </div>
      )}

      {/* Evidence pointer to open full document */}
      <EvidencePointer documentId={row.documentId} filename={row.filename} />

      {/* Metadata */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {cell.latencyMs != null && <span>{(cell.latencyMs / 1000).toFixed(1)}s</span>}
        {cell.usage && (
          <span>{cell.usage.inputTokens + cell.usage.outputTokens} tokens</span>
        )}
      </div>
    </div>
  );
}
