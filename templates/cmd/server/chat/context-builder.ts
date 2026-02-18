import { db } from "@/server/db";

export async function buildSubmissionContext(
  submissionId: string,
): Promise<string> {
  const sub: any = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      documents: {
        select: {
          id: true,
          filename: true,
          documentType: true,
          tables: {
            select: { id: true, tableIndex: true, description: true, rows: true, columns: true },
            orderBy: { tableIndex: "asc" },
          },
        },
      },
      findings: {
        select: {
          id: true,
          severity: true,
          category: true,
          title: true,
          description: true,
          suggestedFix: true,
        },
      },
      report: {
        select: {
          blockerCount: true,
          majorCount: true,
          minorCount: true,
          observationCount: true,
          content: true,
        },
      },
    },
  });

  if (!sub) return "";

  const lines: string[] = [
    `## Submission: ${sub.title}`,
    `Status: ${sub.status} | PPAP Level: ${sub.ppapLevel}`,
  ];

  if (sub.partNumber) lines.push(`Part Number: ${sub.partNumber}`);
  if (sub.partName) lines.push(`Part Name: ${sub.partName}`);
  if (sub.customerName) lines.push(`Customer: ${sub.customerName}`);
  if (sub.supplierName) lines.push(`Supplier: ${sub.supplierName}`);
  if (sub.revision) lines.push(`Revision: ${sub.revision}`);
  if (sub.drawingNumber) lines.push(`Drawing Number: ${sub.drawingNumber}`);

  if (sub.documents.length > 0) {
    lines.push(`\n### Documents (${sub.documents.length})`);
    for (const doc of sub.documents) {
      lines.push(`- ${doc.filename} (${doc.documentType ?? "unclassified"}) [id: ${doc.id}]`);
      if (doc.tables && doc.tables.length > 0) {
        for (const table of doc.tables) {
          const desc = table.description || "no description";
          lines.push(`  - Table ${table.tableIndex}: ${desc} (${table.rows}x${table.columns}) [id: ${table.id}]`);
        }
      }
    }
  }

  if (sub.report) {
    lines.push(`\n### Report Summary`);
    lines.push(
      `Blockers: ${sub.report.blockerCount}, Major: ${sub.report.majorCount}, Minor: ${sub.report.minorCount}, Observations: ${sub.report.observationCount}`,
    );
  }

  if (sub.findings.length > 0) {
    lines.push(`\n### Findings (${sub.findings.length})`);
    for (const f of sub.findings) {
      lines.push(`- [${f.severity}] ${f.title}: ${f.description} [id: ${f.id}]`);
      if (f.suggestedFix) lines.push(`  Fix: ${f.suggestedFix}`);
    }
  }

  lines.push(
    `\nYou have full tool access to this submission. Use list_documents, search_documents, get_document_details, get_document_chunks, get_document_tables, and get_document_images to answer any question about these documents.`,
  );

  return lines.join("\n");
}
