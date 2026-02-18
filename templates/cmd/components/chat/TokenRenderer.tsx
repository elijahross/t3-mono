"use client";

import { useTranslations } from "next-intl";
import { PaperclipIcon } from "lucide-react";
import type { ChatToken } from "@/lib/chat-tokens";
import { ReferenceBadge } from "@/components/chat/tokens/ReferenceBadge";
import { FindingTokenCard } from "@/components/chat/tokens/FindingTokenCard";
import { RegulationTokenCard } from "@/components/chat/tokens/RegulationTokenCard";

interface TokenRendererProps {
  token: ChatToken;
}

export function TokenRenderer({ token }: TokenRendererProps) {
  const t = useTranslations("chat");

  switch (token.type) {
    case "DOCUMENT":
    case "CHUNK":
    case "IMAGE":
    case "TABLE":
      return <ReferenceBadge tokenType={token.type} id={token.id} />;
    case "FINDING":
      return <FindingTokenCard findingId={token.id} />;
    case "REGULATION":
      return <RegulationTokenCard requirementId={token.id} />;
    case "ATTACHMENT":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          <PaperclipIcon className="size-3" />
          <span>attachment</span>
        </span>
      );
    default:
      return (
        <span className="text-xs text-muted-foreground italic">
          [{t("referenceNotFound")}]
        </span>
      );
  }
}
