/**
 * Tool definitions and execution for the chat agent.
 * Tools run Prisma queries directly (except search_documents which calls the internal API).
 */

import { z } from "zod";
import { db } from "@/server/db";
import { EmbeddingGenerator } from "@/components/ai/core/embedding";

// ============================================================================
// Tool Definitions (plain objects to avoid TS2589 from LangChain tool())
// ============================================================================

export const chatTools = [
  {
    name: "get_document_details",
    description:
      "Get full document metadata, extracted content, and extracted data fields. Returns the complete extracted text. Call after discovering a document ID via list_documents.",
    schema: z.object({
      documentId: z.string().describe("The document ID"),
    }),
  },
  {
    name: "get_document_chunks",
    description:
      "Get text chunks for a document, optionally filtered by page number. Returns chunk content, index, page, sheet name, and type.",
    schema: z.object({
      documentId: z.string().describe("The document ID"),
      pageNumber: z.number().int().optional().describe("Optional page number filter"),
    }),
  },
  {
    name: "get_document_tables",
    description:
      "Get all extracted tables for a document. Returns markdown content, description, dimensions, and page number. Use when analyzing tabular data.",
    schema: z.object({
      documentId: z.string().describe("The document ID"),
    }),
  },
  {
    name: "get_document_images",
    description:
      "Get image metadata for a document. Returns image ID, page, format, dimensions, and description. No presigned URLs.",
    schema: z.object({
      documentId: z.string().describe("The document ID"),
    }),
  },
  {
    name: "get_finding_details",
    description:
      "Get full details of a specific finding including severity, category, description, evidence pointers, and suggested fix.",
    schema: z.object({
      findingId: z.string().describe("The finding ID"),
    }),
  },
  {
    name: "get_checklist_details",
    description:
      "Get a checklist with all its items including element numbers, names, required levels, and document types.",
    schema: z.object({
      checklistId: z.string().describe("The checklist ID"),
    }),
  },
  {
    name: "get_document_type_definition",
    description:
      "Get a document type definition including extraction fields, validation rules, and classification hints.",
    schema: z.object({
      code: z.string().describe("The document type code (e.g. 'PSW', 'PFMEA')"),
    }),
  },
  {
    name: "search_documents",
    description:
      "Hybrid vector + keyword search across all document chunks in the submission. Returns ranked results with content. Use this to find specific content across all documents. Works without knowing document IDs — just provide a query and optional documentType filter.",
    schema: z.object({
      query: z.string().describe("Search query text"),
      documentType: z.string().optional().describe("Optional document type filter"),
    }),
  },
  {
    name: "get_attachment_content",
    description:
      "Get extracted text content and chunks from a user-uploaded chat attachment. Use when the user asks about a specific attached file.",
    schema: z.object({
      attachmentId: z.string().describe("The attachment ID"),
    }),
  },
  {
    name: "search_attachment_chunks",
    description:
      "Search across all chat attachment chunks in this conversation using hybrid vector + keyword search. Use when the user asks questions about their attached files.",
    schema: z.object({
      query: z.string().describe("Search query text"),
    }),
  },
  {
    name: "list_documents",
    description:
      "List all documents in the current submission with their IDs, filenames, types, and extraction status. Call this FIRST to discover what documents exist. No parameters needed — just call it. Use the returned IDs with get_document_details or other document tools.",
    schema: z.object({
      documentType: z.string().optional().describe("Optional document type filter"),
    }),
  },
  {
    name: "list_findings",
    description:
      "List all findings for the current submission with their IDs, severity, category, and title. Use this to discover finding IDs before calling get_finding_details.",
    schema: z.object({
      severity: z.enum(["BLOCKER", "MAJOR", "MINOR", "OBSERVATION"]).optional().describe("Optional severity filter"),
    }),
  },
  {
    name: "search_regulations",
    description:
      "Search the regulations knowledge base for specific regulatory requirements from standards like VDA, IATF, DIN/ISO. Returns matching requirements with their IDs, titles, descriptions, sections, and attribute conditions. Use when the user asks about regulatory standards or when checklist items reference specific standards. If the user is viewing a specific regulation collection, pass its collectionId to scope results. Embed [[[REGULATION_<requirementId>]]] tokens in your response for returned requirements.",
    schema: z.object({
      query: z.string().describe("Search query (e.g. 'tensile strength test requirements', 'VDA Band 2 surface roughness')"),
      attributes: z.record(z.string(), z.array(z.string())).optional().describe("Optional attribute filters, e.g. { materialType: ['steel'] }"),
      collectionId: z.string().optional().describe("Optional regulation collection ID to scope search to a specific collection"),
    }),
  },
];

// ============================================================================
// Tool Execution
// ============================================================================

export async function executeChatTool(
  name: string,
  args: Record<string, any>,
  submissionId?: string,
  threadId?: string,
): Promise<any> {
  switch (name) {
    case "get_document_details": {
      const doc = await db.document.findUnique({
        where: { id: args.documentId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          documentType: true,
          extractedContent: true,
          extractedData: true,
          fileSize: true,
          extractionStatus: true,
          createdAt: true,
        },
      });
      if (!doc) return { error: "Document not found" };
      return doc;
    }

    case "get_document_chunks": {
      const where: any = { documentId: args.documentId };
      if (args.pageNumber != null) where.pageNumber = args.pageNumber;

      const chunks = await db.documentChunk.findMany({
        where,
        select: {
          id: true,
          content: true,
          chunkIndex: true,
          pageNumber: true,
          sheetName: true,
          chunkType: true,
        },
        orderBy: { chunkIndex: "asc" },
        take: 30,
      });
      return { chunks };
    }

    case "get_document_tables": {
      const tables = await db.extractedTable.findMany({
        where: { documentId: args.documentId },
        select: {
          id: true,
          tableIndex: true,
          pageNumber: true,
          rows: true,
          columns: true,
          markdownContent: true,
          description: true,
        },
        orderBy: { tableIndex: "asc" },
      });
      return { tables };
    }

    case "get_document_images": {
      const images = await db.extractedImage.findMany({
        where: { documentId: args.documentId },
        select: {
          id: true,
          imageIndex: true,
          pageNumber: true,
          format: true,
          width: true,
          height: true,
          description: true,
        },
        orderBy: { imageIndex: "asc" },
      });
      return { images };
    }

    case "get_finding_details": {
      const finding = await db.finding.findUnique({
        where: { id: args.findingId },
        select: {
          id: true,
          severity: true,
          category: true,
          title: true,
          description: true,
          evidencePointers: true,
          suggestedFix: true,
          createdAt: true,
        },
      });
      if (!finding) return { error: "Finding not found" };
      return finding;
    }

    case "get_checklist_details": {
      const checklist = await db.checklist.findUnique({
        where: { id: args.checklistId },
        include: {
          items: {
            orderBy: { elementNumber: "asc" },
            select: {
              id: true,
              elementNumber: true,
              elementName: true,
              description: true,
              requiredForLevel: true,
              documentTypes: true,
            },
          },
        },
      });
      if (!checklist) return { error: "Checklist not found" };
      return checklist;
    }

    case "get_document_type_definition": {
      const typeDef = await db.documentTypeDefinition.findUnique({
        where: { code: args.code },
      });
      if (!typeDef) return { error: `Document type '${args.code}' not found` };
      return typeDef;
    }

    case "search_documents": {
      if (!submissionId) return { error: "No submission context for search" };

      const internalUrl = process.env.NEXT_APP_URL || "http://localhost:3000";
      const secret = process.env.INTERNAL_API_SECRET || "";

      const res = await fetch(`${internalUrl}/api/internal/search-documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submissionId,
          query: args.query,
          documentType: args.documentType,
          limit: 10,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: `Search failed: ${body.error || res.statusText}` };
      }
      return res.json();
    }

    case "get_attachment_content": {
      const attachment = await db.chatAttachment.findUnique({
        where: { id: args.attachmentId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          fileSize: true,
          extractedContent: true,
          processingStatus: true,
          chunks: {
            select: { id: true, content: true, chunkIndex: true, chunkType: true },
            orderBy: { chunkIndex: "asc" },
            take: 30,
          },
        },
      });
      if (!attachment) return { error: "Attachment not found" };
      return attachment;
    }

    case "search_attachment_chunks": {
      if (!threadId) return { error: "No thread context for attachment search" };

      try {
        const embeddingGen = new EmbeddingGenerator({
          provider: "ollama",
          model: process.env.EMBEDDING_MODEL || "nomic-embed-text",
          baseURL: process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        });
        const queryResult = await embeddingGen.embed(args.query);
        const vectorStr = `[${queryResult.embedding.join(",")}]`;

        // Semantic search via pgvector
        const semanticResults: any[] = await db.$queryRawUnsafe(
          `SELECT cac.id, cac.content, cac."attachmentId", cac."chunkIndex", cac."chunkType",
                  ca.filename,
                  1 - (cac.embedding <=> $1::vector) as score
           FROM "ChatAttachmentChunk" cac
           JOIN "ChatAttachment" ca ON cac."attachmentId" = ca.id
           WHERE ca."threadId" = $2
             AND cac.embedding IS NOT NULL
           ORDER BY cac.embedding <=> $1::vector
           LIMIT 10`,
          vectorStr,
          threadId,
        );

        // Keyword search via ILIKE
        const keywordResults: any[] = await db.$queryRawUnsafe(
          `SELECT cac.id, cac.content, cac."attachmentId", cac."chunkIndex", cac."chunkType",
                  ca.filename,
                  0.5 as score
           FROM "ChatAttachmentChunk" cac
           JOIN "ChatAttachment" ca ON cac."attachmentId" = ca.id
           WHERE ca."threadId" = $1
             AND cac.content ILIKE $2
           LIMIT 10`,
          threadId,
          `%${args.query}%`,
        );

        // Merge + deduplicate
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const r of semanticResults) {
          if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
        }
        for (const r of keywordResults) {
          if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
          else {
            const existing = merged.find((m) => m.id === r.id);
            if (existing) existing.score = Math.min(1, Number(existing.score) + 0.15);
          }
        }
        merged.sort((a, b) => Number(b.score) - Number(a.score));

        return {
          results: merged.slice(0, 10).map((r) => ({
            chunkId: r.id,
            attachmentId: r.attachmentId,
            filename: r.filename,
            content: r.content,
            score: Number(r.score),
            chunkType: r.chunkType ?? r.chunk_type,
            chunkIndex: r.chunkIndex ?? r.chunk_index,
          })),
        };
      } catch (error: any) {
        return { error: `Attachment search failed: ${error?.message}` };
      }
    }

    case "list_documents": {
      if (!submissionId) return { error: "No submission context" };
      const where: any = { submissionId };
      if (args.documentType) where.documentType = args.documentType;
      const documents = await db.document.findMany({
        where,
        select: { id: true, filename: true, documentType: true, extractionStatus: true, fileSize: true },
        orderBy: { createdAt: "asc" },
      });
      return { documents };
    }

    case "list_findings": {
      if (!submissionId) return { error: "No submission context" };
      const where: any = { submissionId };
      if (args.severity) where.severity = args.severity;
      const findings = await db.finding.findMany({
        where,
        select: { id: true, severity: true, category: true, title: true },
        orderBy: { createdAt: "asc" },
      });
      return { findings };
    }

    case "search_regulations": {
      const internalUrl = process.env.NEXT_APP_URL || "http://localhost:3000";
      const secret = process.env.INTERNAL_API_SECRET || "";

      const res = await fetch(`${internalUrl}/api/internal/search-regulations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: args.query,
          attributes: args.attributes,
          collectionId: args.collectionId,
          limit: 10,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: `Regulation search failed: ${body.error || res.statusText}` };
      }
      return res.json();
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
