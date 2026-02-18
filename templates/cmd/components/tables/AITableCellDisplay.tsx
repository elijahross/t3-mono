"use client";

import { useState, useRef } from "react";
import {
  CheckIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AITableCell, ColumnOutputFormat } from "@/lib/ai-table-types";

function getBadgeColorClass(value: string): string {
  const v = value.trim().toLowerCase();
  // Green
  if (/^(pass|yes|true|compliant|approved|good|met)$/.test(v)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  // Red
  if (/^(fail|no|false|non-compliant|rejected|critical|blocker)$/.test(v)) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  // Amber
  if (/^(warning|caution|medium|partial|pending|major|needs review)$/.test(v)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  // Blue
  if (/^(info|low|minor|observation|n\/a|neutral)$/.test(v)) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  return "";
}

interface AITableCellDisplayProps {
  cell?: AITableCell;
  outputFormat: ColumnOutputFormat;
  isUserInput?: boolean;
  onClick?: () => void;
  onEdit?: (value: string) => void;
}

export function AITableCellDisplay({
  cell,
  outputFormat,
  isUserInput,
  onClick,
  onEdit,
}: AITableCellDisplayProps) {
  const t = useTranslations("tables");
  const [localValue, setLocalValue] = useState(cell?.result ?? "");
  const committedRef = useRef(cell?.result ?? "");

  // Keep local value in sync when cell result changes externally
  if (cell?.result !== undefined && cell.result !== committedRef.current) {
    committedRef.current = cell.result;
    setLocalValue(cell.result);
  }

  if (isUserInput) {
    const commit = () => {
      if (localValue !== committedRef.current) {
        committedRef.current = localValue;
        onEdit?.(localValue);
      }
    };
    return (
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="w-full bg-transparent px-0 py-0 text-xs outline-none border-b border-transparent focus:border-primary transition-colors"
      />
    );
  }

  if (!cell || cell.status === "pending") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (cell.status === "running") {
    return (
      <span className="text-[10px] text-muted-foreground animate-pulse-subtle">
        {t("thinking")}
      </span>
    );
  }

  if (cell.status === "error") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer"
      >
        <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
          {t("error")}
        </Badge>
      </button>
    );
  }

  // cell.status === "complete"
  const value = cell.result ?? "";

  const content = (() => {
    switch (outputFormat) {
      case "boolean": {
        const isTruthy =
          /^(true|yes|pass|1|✓|compliant)$/i.test(value.trim()) ||
          value.toLowerCase().includes("yes") ||
          value.toLowerCase().includes("true") ||
          value.toLowerCase().includes("pass") ||
          value.toLowerCase().includes("compliant");
        return isTruthy ? (
          <CheckIcon className="size-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <XIcon className="size-3.5 text-red-600 dark:text-red-400" />
        );
      }
      case "number":
        return <span className="font-mono">{value}</span>;
      case "badge":
        return (
          <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", getBadgeColorClass(value))}>
            {value}
          </Badge>
        );
      default:
        return <span className="truncate">{value}</span>;
    }
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center transition-colors hover:text-primary"
    >
      {content}
    </button>
  );
}
