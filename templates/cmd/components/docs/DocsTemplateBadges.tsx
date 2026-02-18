"use client";

import { useTranslations } from "next-intl";
import { PresentationIcon, TableIcon, FileTextIcon, CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  DocsOrchestrationResult,
  AIDocTemplate,
  DocConfig,
} from "@/lib/ai-doc-types";

interface DocsTemplateBadgesProps {
  orchestration: DocsOrchestrationResult;
  messageId: string;
  onAddDoc?: (messageId: string, config: DocConfig) => void;
  expandedTemplateIds?: Set<string>;
}

function fileTypeIcon(fileType: string) {
  switch (fileType) {
    case "pptx":
      return PresentationIcon;
    case "xlsx":
      return TableIcon;
    case "pdf":
      return FileTextIcon;
    default:
      return FileTextIcon;
  }
}

export function DocsTemplateBadges({
  orchestration,
  messageId,
  onAddDoc,
  expandedTemplateIds,
}: DocsTemplateBadgesProps) {
  const t = useTranslations("docs");

  const handleClick = (template: AIDocTemplate) => {
    if (expandedTemplateIds?.has(template.id)) return;
    onAddDoc?.(messageId, {
      id: template.id,
      template,
      submissionId: orchestration.submissionId,
    });
  };

  if (!orchestration.templates.length) return null;

  return (
    <div className="mt-3 border-t border-border/30 pt-3">
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
        {t("selectTemplate")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {orchestration.templates.map((tmpl) => {
          const isExpanded = expandedTemplateIds?.has(tmpl.id);
          const Icon = fileTypeIcon(tmpl.fileType);
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleClick(tmpl)}
              className={cn("cursor-pointer", isExpanded && "cursor-default opacity-50")}
              title={tmpl.description}
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
                  <Icon className="size-3" />
                )}
                {tmpl.name}
                <span className="text-[9px] uppercase opacity-60">{tmpl.fileType}</span>
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
