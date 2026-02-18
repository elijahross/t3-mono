use anyhow::Result;
use std::path::Path;

use crate::templates::embedded;
use crate::utils::fs::write_file;

/// Scaffold CommandIsland AI layer (chat, tables, docs, split-view)
pub async fn scaffold(project_path: &str) -> Result<()> {
    let project = Path::new(project_path);

    // ── 1. Copy embedded template files ──────────────────────────────────────
    // components -> src/components
    let components_dest = project.join("src/components");
    tokio::fs::create_dir_all(&components_dest).await?;
    embedded::copy_embedded_dir("cmd/components/", &components_dest).await?;

    // lib -> src/lib
    let lib_dest = project.join("src/lib");
    tokio::fs::create_dir_all(&lib_dest).await?;
    embedded::copy_embedded_dir("cmd/lib/", &lib_dest).await?;

    // server -> src/server
    let server_dest = project.join("src/server");
    tokio::fs::create_dir_all(&server_dest).await?;
    embedded::copy_embedded_dir("cmd/server/", &server_dest).await?;

    // ── 2. Overwrite tRPC init with auth-aware version ───────────────────────
    write_file(project_path, "src/server/api/trpc.ts", TRPC_INIT_WITH_AUTH)?;

    // ── 3. Overwrite tRPC root to register cmd routers ───────────────────────
    write_file(project_path, "src/server/api/root.ts", TRPC_ROOT_WITH_CMD)?;

    // ── 4. Modify Prisma schema ──────────────────────────────────────────────
    modify_prisma_schema(project_path)?;

    // ── 5. Merge translations ────────────────────────────────────────────────
    merge_translations(project_path, "messages/en.json", CMD_MESSAGES_EN)?;
    merge_translations(project_path, "messages/de.json", CMD_MESSAGES_DE)?;

    // ── 6. Write CommandIslandLayout wrapper ─────────────────────────────────
    write_file(
        project_path,
        "src/app/_components/CommandIslandLayout.tsx",
        CMD_LAYOUT_WRAPPER,
    )?;

    // ── 7. Overwrite root layout to include CommandIslandLayout ──────────────
    write_file(project_path, "src/app/layout.tsx", APP_LAYOUT_WITH_CMD)?;

    // ── 8. Write PageGuide stub ──────────────────────────────────────────────
    write_file(
        project_path,
        "src/components/layout/PageGuide.tsx",
        PAGE_GUIDE_STUB,
    )?;

    // ── 9. Write Claude skill ────────────────────────────────────────────────
    let claude_dir = project.join(".claude/skills");
    tokio::fs::create_dir_all(&claude_dir).await?;
    write_file(
        project_path,
        ".claude/skills/commandisland.md",
        CLAUDE_CMD_SKILL,
    )?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma schema modification
// ─────────────────────────────────────────────────────────────────────────────

fn modify_prisma_schema(project_path: &str) -> Result<()> {
    let schema_path = Path::new(project_path).join("prisma/schema.prisma");
    let mut content = std::fs::read_to_string(&schema_path)?;

    // Replace generator block to add previewFeatures
    content = content.replace(
        r#"generator client {
  provider = "prisma-client-js"
}"#,
        r#"generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}"#,
    );

    // Replace datasource block to add extensions
    content = content.replace(
        r#"datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}"#,
        r#"datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}"#,
    );

    // Add reverse relations to User model
    // Find the User model's closing fields and inject before the last }
    if content.contains("model User {") {
        content = content.replace(
            "  sessions Session[]\n  accounts Account[]\n}",
            "  sessions Session[]\n  accounts Account[]\n\n  chatThreads     ChatThread[]\n  aiTableSessions AITableSession[]\n  aiDocSessions   AIDocSession[]\n}",
        );
    }

    // Append cmd models
    content.push_str(CMD_PRISMA_MODELS);

    std::fs::write(schema_path, content)?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Translation merging
// ─────────────────────────────────────────────────────────────────────────────

fn merge_translations(
    project_path: &str,
    relative_path: &str,
    cmd_json: &str,
) -> Result<()> {
    let file_path = Path::new(project_path).join(relative_path);
    let existing = std::fs::read_to_string(&file_path)?;
    let mut base: serde_json::Value = serde_json::from_str(&existing)?;
    let additions: serde_json::Value = serde_json::from_str(cmd_json)?;

    if let (Some(base_obj), Some(additions_obj)) =
        (base.as_object_mut(), additions.as_object())
    {
        for (key, value) in additions_obj {
            base_obj.insert(key.clone(), value.clone());
        }
    }

    let merged = serde_json::to_string_pretty(&base)?;
    std::fs::write(file_path, merged)?;

    Ok(())
}

// ============================================================================
// Inline Constants
// ============================================================================

const TRPC_INIT_WITH_AUTH: &str = r#"import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { headers } from "next/headers";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return {
    db,
    session,
    userId: session?.user?.id,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
      userId: ctx.session.user.id,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
"#;

const TRPC_ROOT_WITH_CMD: &str = r#"import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { chatRouter } from "@/server/api/routers/chat";
import { tablesRouter } from "@/server/api/routers/tables";
import { docsRouter } from "@/server/api/routers/docs";

export const appRouter = createTRPCRouter({
  chat: chatRouter,
  tables: tablesRouter,
  docs: docsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
"#;

const CMD_PRISMA_MODELS: &str = r#"
// ============================================================================
// CommandIsland AI Models
// ============================================================================

enum ProcessingStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum ChunkType {
  TEXT
  TABLE
  HEADER
  FORM_FIELD
  LIST
  IMAGE_DESCRIPTION
}

model ChatThread {
  id           String       @id @default(cuid())
  title        String?
  submissionId String?
  userId       String
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages     ChatMessage[]
  attachments  ChatAttachment[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([userId])
  @@index([submissionId])
}

model ChatMessage {
  id        String     @id @default(cuid())
  role      String
  content   String
  metadata  Json?
  threadId  String
  thread    ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now())

  @@index([threadId])
}

model ChatAttachment {
  id               String           @id @default(cuid())
  filename         String
  mimeType         String
  s3Key            String
  fileSize         Int?
  extractedContent String?
  processingStatus ProcessingStatus @default(PENDING)
  error            String?

  threadId String
  thread   ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  chunks ChatAttachmentChunk[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([threadId])
}

model ChatAttachmentChunk {
  id         String    @id @default(cuid())
  content    String
  chunkIndex Int
  chunkType  ChunkType @default(TEXT)
  embedding  Unsupported("vector(1024)")?

  attachmentId String
  attachment   ChatAttachment @relation(fields: [attachmentId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([attachmentId])
}

model AITableSession {
  id           String     @id @default(cuid())
  submissionId String
  messageId    String?
  useCase      Json
  columns      Json
  results      Json       @default("{}")
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([submissionId])
  @@index([userId])
  @@index([messageId])
}

model AIDocSession {
  id           String     @id @default(cuid())
  submissionId String
  messageId    String?
  template     Json
  sections     Json
  fileType     String
  status       String     @default("pending")
  s3Key        String?
  filename     String?
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([submissionId])
  @@index([userId])
  @@index([messageId])
}
"#;

const CMD_MESSAGES_EN: &str = r#"{
  "commandIsland": {
    "queryMode": "Filter",
    "aiMode": "AI Assistant",
    "clearQuery": "Clear filter",
    "defaultPlaceholder": "Type to filter...",
    "aiPlaceholder": "Ask about this submission...",
    "comingSoon": "AI assistant coming soon",
    "attach": "Attach file",
    "send": "Send",
    "toggleChat": "Toggle chat",
    "unsupportedFileType": "Unsupported file type. Accepted: PDF, Word, Excel, PowerPoint, text, images.",
    "fileTooLarge": "File too large. Maximum 50 MB.",
    "removeAttachment": "Remove",
    "toggleContext": "Show context",
    "contextSubmission": "Submission",
    "contextDocument": "Document",
    "contextFinding": "Finding",
    "contextChunk": "Chunk",
    "contextChecklist": "Checklist",
    "contextDocType": "Doc Type",
    "contextRegulation": "Regulation",
    "tablesMode": "AI Tables",
    "tablesPlaceholder": "Describe what to analyze across documents...",
    "docsMode": "AI Docs",
    "docsPlaceholder": "Describe what document to generate...",
    "aiSuggestions": "AI Suggestions",
    "suggestSummarize": "Summarize submission",
    "suggestCompliance": "Compliance check",
    "suggestFindings": "List findings",
    "suggestCrossRef": "Cross-reference",
    "suggestRisks": "Quality risks",
    "suggestExtractData": "Extract data"
  },
  "tables": {
    "document": "Document",
    "runAll": "Run All",
    "addColumn": "Add Column",
    "export": "Export CSV",
    "runColumn": "Run Column",
    "removeColumn": "Remove",
    "columnConfig": "Configure column",
    "modelSelector": "Model",
    "outputFormat": "Output Format",
    "agentDescription": "Agent Prompt",
    "save": "Save",
    "selectUseCase": "Select a use case",
    "cellsComplete": "{count} of {total} cells complete",
    "noSubmission": "No submission selected",
    "answer": "Answer",
    "explanation": "Explanation",
    "sourceReference": "Source Reference",
    "selectAgent": "Select an agent type",
    "customColumn": "Custom Column",
    "customColumnDescription": "Define your own agent with a custom prompt",
    "columnName": "Column Name",
    "columnNamePlaceholder": "e.g., Part Number Check",
    "back": "Back",
    "thinking": "Thinking\u2026",
    "error": "Error",
    "refreshColumn": "Re-run Column",
    "reasoningLevel": "Reasoning",
    "reasoningOff": "Off",
    "reasoningLow": "Low",
    "reasoningMedium": "Medium",
    "reasoningHigh": "High",
    "tools": "Tools",
    "agentSettings": "Agent Settings",
    "complianceStandards": "Standards / Requirements",
    "complianceStandardsPlaceholder": "e.g., IATF 16949 Section 8.3, AIAG PPAP 4th Edition",
    "fieldsToExtract": "Values to Extract",
    "fieldsToExtractPlaceholder": "e.g., Part Number, Revision Level, Material Spec, Dimensions",
    "focusArea": "Focus Area",
    "focusAreaPlaceholder": "e.g., dimensional data, material certifications",
    "summaryLength": "Summary Length",
    "summaryBrief": "Brief (1-2 sentences)",
    "summaryStandard": "Standard (1 paragraph)",
    "summaryDetailed": "Detailed (multi-paragraph)",
    "fieldsToCompare": "Fields to Cross-Reference",
    "fieldsToComparePlaceholder": "e.g., part numbers, revision dates, material specs",
    "auditStandards": "Audit Standards",
    "auditStandardsPlaceholder": "e.g., IATF 16949, VDA 6.3, Customer Specific Requirements",
    "riskFocus": "Risk Areas of Focus",
    "riskFocusPlaceholder": "e.g., dimensional tolerances, material traceability",
    "advancedPrompt": "Advanced: System Prompt",
    "userInputColumn": "User Input",
    "userInputColumnDescription": "Add a column for manual data entry"
  },
  "docs": {
    "selectTemplate": "Select a document template",
    "download": "Download",
    "sectionsComplete": "{count} of {total} sections complete",
    "generatingFile": "Generating file...",
    "fileGenerationError": "File generation failed",
    "retry": "Retry",
    "retrySection": "Retry",
    "retryAllFailed": "Retry failed sections",
    "sectionsFailed": "{count} section(s) failed"
  },
  "chat": {
    "title": "AI Assistant",
    "placeholder": "Ask about this submission...",
    "send": "Send",
    "thinking": "Thinking...",
    "newThread": "New Thread",
    "clearThread": "Clear Thread",
    "contextBound": "Submission context",
    "noContext": "General assistant",
    "errorFailed": "Failed to send message. Please try again.",
    "welcomeMessage": "Ask me anything about your data. I can help analyze content, extract information, and suggest improvements.",
    "referenceNotFound": "Reference not found",
    "showMore": "Show more",
    "showLess": "Show less",
    "downloadDocument": "Download document",
    "pageLabel": "Page",
    "viewDocument": "View document",
    "viewTable": "View table",
    "viewImage": "View image"
  }
}"#;

const CMD_MESSAGES_DE: &str = r#"{
  "commandIsland": {
    "queryMode": "Filter",
    "aiMode": "KI-Assistent",
    "clearQuery": "Filter löschen",
    "defaultPlaceholder": "Eingabe zum Filtern...",
    "aiPlaceholder": "Frage zu dieser Einreichung stellen...",
    "comingSoon": "KI-Assistent kommt bald",
    "attach": "Datei anhängen",
    "send": "Senden",
    "toggleChat": "Chat umschalten",
    "unsupportedFileType": "Nicht unterstützter Dateityp. Akzeptiert: PDF, Word, Excel, PowerPoint, Text, Bilder.",
    "fileTooLarge": "Datei zu groß. Maximal 50 MB.",
    "removeAttachment": "Entfernen",
    "toggleContext": "Kontext anzeigen",
    "contextSubmission": "Einreichung",
    "contextDocument": "Dokument",
    "contextFinding": "Befund",
    "contextChunk": "Abschnitt",
    "contextChecklist": "Checkliste",
    "contextDocType": "Dokumenttyp",
    "contextRegulation": "Vorschrift",
    "tablesMode": "AI Tabellen",
    "tablesPlaceholder": "Beschreiben Sie, was über alle Dokumente analysiert werden soll...",
    "docsMode": "AI Dokumente",
    "docsPlaceholder": "Beschreiben Sie, welches Dokument erstellt werden soll...",
    "aiSuggestions": "KI-Vorschläge",
    "suggestSummarize": "Einreichung zusammenfassen",
    "suggestCompliance": "Konformitätsprüfung",
    "suggestFindings": "Befunde auflisten",
    "suggestCrossRef": "Querverweise prüfen",
    "suggestRisks": "Qualitätsrisiken",
    "suggestExtractData": "Daten extrahieren"
  },
  "tables": {
    "document": "Dokument",
    "runAll": "Alle ausführen",
    "addColumn": "Spalte hinzufügen",
    "export": "CSV exportieren",
    "runColumn": "Spalte ausführen",
    "removeColumn": "Entfernen",
    "columnConfig": "Spalte konfigurieren",
    "modelSelector": "Modell",
    "outputFormat": "Ausgabeformat",
    "agentDescription": "Agent-Prompt",
    "save": "Speichern",
    "selectUseCase": "Anwendungsfall auswählen",
    "cellsComplete": "{count} von {total} Zellen abgeschlossen",
    "noSubmission": "Keine Einreichung ausgewählt",
    "answer": "Antwort",
    "explanation": "Erklärung",
    "sourceReference": "Quellenreferenz",
    "selectAgent": "Agententyp auswählen",
    "customColumn": "Benutzerdefinierte Spalte",
    "customColumnDescription": "Eigenen Agenten mit benutzerdefiniertem Prompt erstellen",
    "columnName": "Spaltenname",
    "columnNamePlaceholder": "z.B. Teilenummer-Prüfung",
    "back": "Zurück",
    "thinking": "Denkt nach\u2026",
    "error": "Fehler",
    "refreshColumn": "Spalte neu ausführen",
    "reasoningLevel": "Reasoning",
    "reasoningOff": "Aus",
    "reasoningLow": "Niedrig",
    "reasoningMedium": "Mittel",
    "reasoningHigh": "Hoch",
    "tools": "Werkzeuge",
    "agentSettings": "Agent-Einstellungen",
    "complianceStandards": "Standards / Anforderungen",
    "complianceStandardsPlaceholder": "z.B. IATF 16949 Abschnitt 8.3, AIAG PPAP 4. Ausgabe",
    "fieldsToExtract": "Zu extrahierende Werte",
    "fieldsToExtractPlaceholder": "z.B. Teilenummer, Revisionsstand, Werkstoffspezifikation, Maße",
    "focusArea": "Schwerpunktbereich",
    "focusAreaPlaceholder": "z.B. Maßdaten, Werkstoffzertifikate",
    "summaryLength": "Zusammenfassungslänge",
    "summaryBrief": "Kurz (1-2 Sätze)",
    "summaryStandard": "Standard (1 Absatz)",
    "summaryDetailed": "Ausführlich (mehrere Absätze)",
    "fieldsToCompare": "Felder zum Quervergleich",
    "fieldsToComparePlaceholder": "z.B. Teilenummern, Revisionsdaten, Werkstoffspezifikationen",
    "auditStandards": "Prüfstandards",
    "auditStandardsPlaceholder": "z.B. IATF 16949, VDA 6.3, Kundenspezifische Anforderungen",
    "riskFocus": "Risikoschwerpunkte",
    "riskFocusPlaceholder": "z.B. Maßtoleranzen, Werkstoffrückverfolgbarkeit",
    "advancedPrompt": "Erweitert: System-Prompt",
    "userInputColumn": "Benutzereingabe",
    "userInputColumnDescription": "Spalte zur manuellen Dateneingabe hinzufügen"
  },
  "docs": {
    "selectTemplate": "Dokumentvorlage auswählen",
    "download": "Herunterladen",
    "sectionsComplete": "{count} von {total} Abschnitten abgeschlossen",
    "generatingFile": "Datei wird erstellt...",
    "fileGenerationError": "Dateierstellung fehlgeschlagen",
    "retry": "Erneut versuchen",
    "retrySection": "Erneut versuchen",
    "retryAllFailed": "Fehlgeschlagene Abschnitte erneut versuchen",
    "sectionsFailed": "{count} Abschnitt(e) fehlgeschlagen"
  },
  "chat": {
    "title": "KI-Assistent",
    "placeholder": "Frage zu dieser Einreichung stellen...",
    "send": "Senden",
    "thinking": "Denkt nach...",
    "newThread": "Neues Gespräch",
    "clearThread": "Gespräch löschen",
    "contextBound": "Einreichungskontext",
    "noContext": "Allgemeiner Assistent",
    "errorFailed": "Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    "welcomeMessage": "Fragen Sie mich zu Ihren Daten. Ich kann Inhalte analysieren, Informationen extrahieren und Verbesserungen vorschlagen.",
    "referenceNotFound": "Referenz nicht gefunden",
    "showMore": "Mehr anzeigen",
    "showLess": "Weniger anzeigen",
    "downloadDocument": "Dokument herunterladen",
    "pageLabel": "Seite",
    "viewDocument": "Dokument anzeigen",
    "viewTable": "Tabelle anzeigen",
    "viewImage": "Bild anzeigen"
  }
}"#;

const APP_LAYOUT_WITH_CMD: &str = r#"import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider, useLocale } from "next-intl";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "./_components/ThemeProvider";
import { CommandIslandLayout } from "./_components/CommandIslandLayout";

export const metadata: Metadata = {
  title: "My App",
  description: "Built with t3-mono",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = useLocale();
  return (
    <html lang={locale} className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <NextIntlClientProvider locale={locale}>
            <TRPCReactProvider>
              <CommandIslandLayout>{children}</CommandIslandLayout>
            </TRPCReactProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
"#;

const CMD_LAYOUT_WRAPPER: &str = r#""use client";

import { useEffect, useCallback } from "react";
import { CommandIslandProvider, useCommandIsland } from "@/lib/command-island-context";
import { SplitViewProvider, useSplitView } from "@/lib/split-view-context";
import { SplitViewShell } from "@/components/layout/SplitViewShell";
import { CommandIsland } from "@/components/layout/CommandIsland";
import { ChatPanel } from "@/components/chat/ChatPanel";

// ---------------------------------------------------------------------------
// Wiring components -- connect CommandIsland modes to SplitView panels
// ---------------------------------------------------------------------------

function ChatWiring() {
  const { setOnAiSubmit, currentSubmissionId, chatSendMessage } =
    useCommandIsland();
  const { rightPanel, openPanel } = useSplitView();

  const handleAiSubmit = useCallback(
    (message: string, attachmentIds?: string[]) => {
      if (rightPanel.open && chatSendMessage) {
        chatSendMessage(message, attachmentIds);
        return;
      }
      openPanel(
        "right",
        <ChatPanel
          submissionId={currentSubmissionId}
          initialMessage={message}
        />,
      );
    },
    [currentSubmissionId, openPanel, rightPanel.open, chatSendMessage],
  );

  useEffect(() => {
    setOnAiSubmit(() => handleAiSubmit);
    return () => setOnAiSubmit(null);
  }, [handleAiSubmit, setOnAiSubmit]);

  return null;
}

function TablesWiring() {
  const { setOnTablesSubmit, currentSubmissionId, chatTablesOrchestrate } =
    useCommandIsland();
  const { rightPanel, openPanel } = useSplitView();

  const handleTablesSubmit = useCallback(
    (prompt: string) => {
      if (rightPanel.open && chatTablesOrchestrate) {
        chatTablesOrchestrate(prompt);
        return;
      }
      openPanel(
        "right",
        <ChatPanel submissionId={currentSubmissionId} tablesPrompt={prompt} />,
      );
    },
    [currentSubmissionId, openPanel, rightPanel.open, chatTablesOrchestrate],
  );

  useEffect(() => {
    setOnTablesSubmit(() => handleTablesSubmit);
    return () => setOnTablesSubmit(null);
  }, [handleTablesSubmit, setOnTablesSubmit]);

  return null;
}

function DocsWiring() {
  const { setOnDocsSubmit, currentSubmissionId, chatDocsOrchestrate } =
    useCommandIsland();
  const { rightPanel, openPanel } = useSplitView();

  const handleDocsSubmit = useCallback(
    (prompt: string) => {
      if (rightPanel.open && chatDocsOrchestrate) {
        chatDocsOrchestrate(prompt);
        return;
      }
      openPanel(
        "right",
        <ChatPanel submissionId={currentSubmissionId} docsPrompt={prompt} />,
      );
    },
    [currentSubmissionId, openPanel, rightPanel.open, chatDocsOrchestrate],
  );

  useEffect(() => {
    setOnDocsSubmit(() => handleDocsSubmit);
    return () => setOnDocsSubmit(null);
  }, [handleDocsSubmit, setOnDocsSubmit]);

  return null;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function CommandIslandLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandIslandProvider>
      <SplitViewProvider>
        <ChatWiring />
        <TablesWiring />
        <DocsWiring />
        <div className="flex min-h-screen flex-col bg-background">
          <SplitViewShell>{children}</SplitViewShell>
          <CommandIsland />
        </div>
      </SplitViewProvider>
    </CommandIslandProvider>
  );
}
"#;

const PAGE_GUIDE_STUB: &str = r#"// PageGuide stub -- imported by SplitViewShell
// Replace with your own page-level guide component if desired.

export function PageGuide() {
  return null;
}

export default PageGuide;
"#;

const CLAUDE_CMD_SKILL: &str = r#"---
skill: commandisland-integration
description: >
  Integrate the CommandIsland AI module (floating command bar, AI chat, AI Tables,
  AI Docs, SplitView panel system) into an existing Next.js + tRPC + Prisma project.
  The module ships as an export/ directory of source files that get copied, wired,
  and customized for the target domain.
prerequisites:
  - Next.js 16+ (App Router)
  - tRPC v11 with superjson transformer
  - Prisma 7+ with PostgreSQL (pgvector extension)
  - Tailwind CSS 4+ with shadcn/ui
  - next-intl for translations
author: prototype-ppap
version: "1.0"
---

# CommandIsland AI Module -- Integration Skill

This project includes the CommandIsland AI module with:

## Components
- **CommandIsland** (`src/components/layout/CommandIsland.tsx`) - Floating command bar with AI/Tables/Docs modes
- **SplitViewShell** (`src/components/layout/SplitViewShell.tsx`) - Split-panel layout system
- **ChatPanel** (`src/components/chat/`) - Full AI chat with streaming, file attachments, reference tokens
- **AITable** (`src/components/tables/`) - AI-powered data tables with agent columns
- **AIDocGenerator** (`src/components/docs/`) - AI document generation (PDF, Excel, PowerPoint)

## Server
- **Chat routers** (`src/server/api/routers/chat.ts`) - tRPC endpoints for chat threads
- **Tables routers** (`src/server/api/routers/tables.ts`) - tRPC endpoints for AI tables
- **Docs routers** (`src/server/api/routers/docs.ts`) - tRPC endpoints for doc generation
- **LLM integration** (`src/server/chat/llm.ts`) - Multi-provider LLM with tool calling
- **Chat tools** (`src/server/chat/chat-tools.ts`) - Database query tools for LLM

## Customization Points
- `src/server/chat/chat-tools.ts` - Add domain-specific tools the LLM can call
- `src/server/chat/llm.ts` - Customize the system prompt
- `src/server/chat/context-builder.ts` - Build entity context for LLM
- `src/lib/ai-table-agent-presets.ts` - Define AI table agent presets
- `src/lib/chat-tokens.ts` - Define inline reference token types
- `src/components/layout/CommandIsland.tsx` - Customize quick suggestions and context entries

## Environment Variables
- `ANTHROPIC_API_KEY` - Required for Claude models
- `OPENAI_API_KEY` - Optional for GPT models
- `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - For file uploads
"#;
