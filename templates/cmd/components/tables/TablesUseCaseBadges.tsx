"use client";

import { useTranslations } from "next-intl";
import { TableIcon, CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  TablesOrchestrationResult,
  AITableUseCase,
  AITableRow,
  TableConfig,
} from "@/lib/ai-table-types";

interface TablesUseCaseBadgesProps {
  orchestration: TablesOrchestrationResult;
  messageId: string;
  onAddTable?: (messageId: string, config: TableConfig) => void;
  expandedUseCaseIds?: Set<string>;
}

function filterDocuments(
  documents: AITableRow[],
  useCase: AITableUseCase,
): AITableRow[] {
  if (!useCase.documentFilter) return documents;
  const { documentTypes, documentIds } = useCase.documentFilter;
  return documents.filter((d) => {
    if (documentIds?.length && !documentIds.includes(d.documentId))
      return false;
    if (
      documentTypes?.length &&
      (!d.documentType || !documentTypes.includes(d.documentType))
    )
      return false;
    return true;
  });
}

export function TablesUseCaseBadges({
  orchestration,
  messageId,
  onAddTable,
  expandedUseCaseIds,
}: TablesUseCaseBadgesProps) {
  const t = useTranslations("tables");

  const handleClick = (useCase: AITableUseCase) => {
    if (expandedUseCaseIds?.has(useCase.id)) return;
    const rows = filterDocuments(orchestration.inputDocuments, useCase);
    onAddTable?.(messageId, {
      id: useCase.id,
      useCase,
      rows,
      submissionId: orchestration.submissionId,
    });
  };

  if (!orchestration.useCases.length) return null;

  return (
    <div className="mt-3 border-t border-border/30 pt-3">
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
        {t("selectUseCase")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {orchestration.useCases.map((uc) => {
          const isExpanded = expandedUseCaseIds?.has(uc.id);
          return (
            <button
              key={uc.id}
              type="button"
              onClick={() => handleClick(uc)}
              className={cn("cursor-pointer", isExpanded && "cursor-default opacity-50")}
              title={uc.description}
              disabled={isExpanded}
            >
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1.5 transition-colors",
                  isExpanded
                    ? "opacity-70"
                    : "hover:bg-primary/10 hover:text-primary",
                )}
              >
                {isExpanded ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <TableIcon className="size-3" />
                )}
                {uc.name}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
