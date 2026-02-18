import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { AIDocTemplate, AIDocSectionResult, DocFileType } from "@/lib/ai-doc-types";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const bucketName = process.env.AWS_S3_BUCKET_NAME || "";

export interface FileGenerationResult {
  s3Key: string;
  filename: string;
}

export async function generateFile(
  sessionId: string,
  template: AIDocTemplate,
  sections: Record<string, AIDocSectionResult>,
): Promise<FileGenerationResult> {
  const completeSections = Object.values(sections).filter(
    (s) => s.status === "complete" && s.content,
  );
  const orderedSections = template.sections
    .map((s) => {
      const result = sections[s.id];
      return result?.status === "complete" ? { def: s, content: result.content } : null;
    })
    .filter(Boolean) as { def: (typeof template.sections)[number]; content: unknown }[];

  let buffer: Buffer;
  let mimeType: string;
  let extension: string;

  switch (template.fileType) {
    case "pptx":
      buffer = await generatePptx(template, orderedSections);
      mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      extension = "pptx";
      break;
    case "xlsx":
      buffer = await generateXlsx(template, orderedSections);
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
      break;
    case "pdf":
      buffer = await generatePdf(template, orderedSections);
      mimeType = "application/pdf";
      extension = "pdf";
      break;
    default:
      throw new Error(`Unsupported file type: ${template.fileType}`);
  }

  const filename = `${template.name.replace(/\s+/g, "-").toLowerCase()}.${extension}`;
  const s3Key = `docs/${sessionId}/${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return { s3Key, filename };
}

// ── PPTX Generation ──

interface SectionData {
  def: { id: string; name: string; type: string };
  content: unknown;
}

async function generatePptx(
  template: AIDocTemplate,
  sections: SectionData[],
): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.author = "PPAP Review";
  pptx.title = template.name;

  const primaryColor = template.style?.primaryColor?.replace("#", "") ?? "2563EB";

  for (const { def, content } of sections) {
    const slide = pptx.addSlide();
    const data = content as Record<string, unknown>;

    switch (def.type) {
      case "title": {
        slide.addText(String(data.heading ?? def.name), {
          x: 0.5,
          y: 1.5,
          w: 9,
          fontSize: 32,
          bold: true,
          color: primaryColor,
        });
        if (data.subtitle) {
          slide.addText(String(data.subtitle), {
            x: 0.5,
            y: 2.5,
            w: 9,
            fontSize: 18,
            color: "666666",
          });
        }
        break;
      }
      case "table": {
        slide.addText(def.name, {
          x: 0.5,
          y: 0.3,
          w: 9,
          fontSize: 20,
          bold: true,
          color: primaryColor,
        });
        const headers = (data.headers as string[]) ?? [];
        const rows = (data.rows as string[][]) ?? [];
        if (headers.length > 0) {
          const tableRows = [
            headers.map((h) => ({ text: h, options: { bold: true, fill: { color: primaryColor }, color: "FFFFFF", fontSize: 10 } })),
            ...rows.map((row) => row.map((cell) => ({ text: cell, options: { fontSize: 9 } }))),
          ];
          slide.addTable(tableRows as any, {
            x: 0.5,
            y: 1.2,
            w: 9,
            border: { pt: 0.5, color: "CCCCCC" },
          });
        }
        break;
      }
      case "bulletList":
      case "summary": {
        slide.addText(String(data.heading ?? def.name), {
          x: 0.5,
          y: 0.3,
          w: 9,
          fontSize: 20,
          bold: true,
          color: primaryColor,
        });
        const items = (data.items ?? data.points ?? []) as string[];
        const bulletText = items.map((item) => ({
          text: item,
          options: { bullet: true, fontSize: 14, breakLine: true },
        }));
        slide.addText(bulletText as any, { x: 0.5, y: 1.2, w: 9, h: 4 });
        break;
      }
      case "keyValue": {
        slide.addText(def.name, {
          x: 0.5,
          y: 0.3,
          w: 9,
          fontSize: 20,
          bold: true,
          color: primaryColor,
        });
        const pairs = (data.pairs as { key: string; value: string }[]) ?? [];
        const kvRows = pairs.map((p) => [
          { text: p.key, options: { bold: true, fontSize: 12 } },
          { text: p.value, options: { fontSize: 12 } },
        ]);
        if (kvRows.length > 0) {
          slide.addTable(kvRows as any, {
            x: 0.5,
            y: 1.2,
            w: 9,
            border: { pt: 0.5, color: "CCCCCC" },
          });
        }
        break;
      }
      case "comparison": {
        slide.addText(String(data.heading ?? def.name), {
          x: 0.5,
          y: 0.3,
          w: 9,
          fontSize: 20,
          bold: true,
          color: primaryColor,
        });
        const cols = (data.columns as string[]) ?? [];
        const compRows = (data.rows as { label: string; values: string[] }[]) ?? [];
        if (cols.length > 0) {
          const headerRow = ["", ...cols].map((h) => ({ text: h, options: { bold: true, fill: { color: primaryColor }, color: "FFFFFF", fontSize: 10 } }));
          const bodyRows = compRows.map((r) => [
            { text: r.label, options: { bold: true, fontSize: 10 } },
            ...r.values.map((v) => ({ text: v, options: { fontSize: 10 } })),
          ]);
          slide.addTable([headerRow, ...bodyRows] as any, {
            x: 0.5,
            y: 1.2,
            w: 9,
            border: { pt: 0.5, color: "CCCCCC" },
          });
        }
        break;
      }
      default: {
        // text and fallback
        slide.addText(def.name, {
          x: 0.5,
          y: 0.3,
          w: 9,
          fontSize: 20,
          bold: true,
          color: primaryColor,
        });
        const body = String(data.body ?? JSON.stringify(data));
        slide.addText(body, {
          x: 0.5,
          y: 1.2,
          w: 9,
          h: 4,
          fontSize: 12,
          valign: "top",
          wrap: true,
        });
        break;
      }
    }
  }

  const arrayBuffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}

// ── XLSX Generation ──

async function generateXlsx(
  template: AIDocTemplate,
  sections: SectionData[],
): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PPAP Review";

  for (const { def, content } of sections) {
    const sheetName = def.name.slice(0, 31); // Excel limit
    const sheet = workbook.addWorksheet(sheetName);
    const data = content as Record<string, unknown>;

    switch (def.type) {
      case "table": {
        const headers = (data.headers as string[]) ?? [];
        const rows = (data.rows as string[][]) ?? [];
        if (headers.length > 0) {
          const headerRow = sheet.addRow(headers);
          headerRow.font = { bold: true };
          headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2563EB" },
          };
          headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
          for (const row of rows) {
            sheet.addRow(row);
          }
          // Auto-width
          sheet.columns.forEach((col) => {
            col.width = 20;
          });
        }
        break;
      }
      case "keyValue": {
        const pairs = (data.pairs as { key: string; value: string }[]) ?? [];
        const headerRow = sheet.addRow(["Field", "Value"]);
        headerRow.font = { bold: true };
        for (const p of pairs) {
          sheet.addRow([p.key, p.value]);
        }
        sheet.columns.forEach((col) => {
          col.width = 30;
        });
        break;
      }
      case "comparison": {
        const cols = (data.columns as string[]) ?? [];
        const compRows = (data.rows as { label: string; values: string[] }[]) ?? [];
        const headerRow = sheet.addRow(["", ...cols]);
        headerRow.font = { bold: true };
        for (const r of compRows) {
          sheet.addRow([r.label, ...r.values]);
        }
        sheet.columns.forEach((col) => {
          col.width = 20;
        });
        break;
      }
      case "bulletList":
      case "summary": {
        sheet.addRow([data.heading ?? def.name]).font = { bold: true, size: 14 };
        sheet.addRow([]);
        const items = (data.items ?? data.points ?? []) as string[];
        for (const item of items) {
          sheet.addRow([`• ${item}`]);
        }
        sheet.getColumn(1).width = 60;
        break;
      }
      default: {
        sheet.addRow([def.name]).font = { bold: true, size: 14 };
        sheet.addRow([]);
        const body = String(data.body ?? JSON.stringify(data));
        sheet.addRow([body]);
        sheet.getColumn(1).width = 80;
        break;
      }
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ── PDF Generation (pdfkit — Node.js native) ──

async function generatePdf(
  template: AIDocTemplate,
  sections: SectionData[],
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const vfsFontsMod: any = await import("pdfmake/build/vfs_fonts");
  const fontsData = vfsFontsMod.default ?? vfsFontsMod;

  const regularBuf = Buffer.from(fontsData["Roboto-Regular.ttf"], "base64");
  const boldBuf = Buffer.from(fontsData["Roboto-Medium.ttf"], "base64");
  const italicBuf = Buffer.from(fontsData["Roboto-Italic.ttf"], "base64");

  const primaryColor = template.style?.primaryColor ?? "#2563EB";
  const PAGE_WIDTH = 595.28; // A4
  const MARGIN = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  // autoFirstPage: false prevents pdfkit from loading the default Helvetica
  // font from disk, which fails in Next.js's bundled server environment.
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: template.name, Author: "PPAP Review" },
  });

  doc.registerFont("Roboto", regularBuf);
  doc.registerFont("Roboto-Bold", boldBuf);
  doc.registerFont("Roboto-Italic", italicBuf);
  doc.font("Roboto");
  doc.addPage();

  for (let i = 0; i < sections.length; i++) {
    const { def, content } = sections[i]!;
    const data = content as Record<string, unknown>;

    if (i > 0) doc.moveDown(1);

    switch (def.type) {
      case "title": {
        doc.font("Roboto-Bold").fontSize(26).fillColor(primaryColor)
          .text(stripInlineMarkdown(String(data.heading ?? def.name)));
        if (data.subtitle) {
          doc.moveDown(0.3);
          doc.font("Roboto").fontSize(14).fillColor("#666666")
            .text(stripInlineMarkdown(String(data.subtitle)));
        }
        doc.moveDown(1);
        break;
      }

      case "table": {
        doc.font("Roboto-Bold").fontSize(16).fillColor(primaryColor)
          .text(def.name);
        doc.moveDown(0.4);
        const headers = ((data.headers as string[]) ?? []).map(stripInlineMarkdown);
        const rows = ((data.rows as string[][]) ?? []).map(
          (row) => row.map(stripInlineMarkdown),
        );
        if (headers.length > 0) {
          drawTable(doc, headers, rows, CONTENT_WIDTH, primaryColor);
        }
        break;
      }

      case "bulletList":
      case "summary": {
        doc.font("Roboto-Bold").fontSize(16).fillColor(primaryColor)
          .text(stripInlineMarkdown(String(data.heading ?? def.name)));
        doc.moveDown(0.4);
        const items = (data.items ?? data.points ?? []) as string[];
        doc.font("Roboto").fontSize(11).fillColor("#000000");
        for (const item of items) {
          renderInlineSpans(doc, `\u2022  ${item}`, { indent: 10 });
          doc.moveDown(0.2);
        }
        break;
      }

      case "keyValue": {
        doc.font("Roboto-Bold").fontSize(16).fillColor(primaryColor)
          .text(def.name);
        doc.moveDown(0.4);
        const pairs = (data.pairs as { key: string; value: string }[]) ?? [];
        if (pairs.length > 0) {
          drawTable(
            doc,
            ["Field", "Value"],
            pairs.map((p) => [stripInlineMarkdown(p.key), stripInlineMarkdown(p.value)]),
            CONTENT_WIDTH,
            primaryColor,
          );
        }
        break;
      }

      case "comparison": {
        doc.font("Roboto-Bold").fontSize(16).fillColor(primaryColor)
          .text(stripInlineMarkdown(String(data.heading ?? def.name)));
        doc.moveDown(0.4);
        const cols = ((data.columns as string[]) ?? []).map(stripInlineMarkdown);
        const compRows = (data.rows as { label: string; values: string[] }[]) ?? [];
        if (cols.length > 0) {
          drawTable(
            doc,
            ["", ...cols],
            compRows.map((r) => [stripInlineMarkdown(r.label), ...r.values.map(stripInlineMarkdown)]),
            CONTENT_WIDTH,
            primaryColor,
          );
        }
        break;
      }

      default: {
        doc.font("Roboto-Bold").fontSize(16).fillColor(primaryColor)
          .text(def.name);
        doc.moveDown(0.4);
        const body = String(data.body ?? JSON.stringify(data));
        renderMarkdown(doc, body, primaryColor);
        break;
      }
    }
  }

  // Collect stream into buffer
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

// ── Markdown → pdfkit rendering ──

interface MdSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/** Parse a markdown string into an array of styled spans */
function parseMarkdownSpans(md: string): MdSpan[] {
  const spans: MdSpan[] = [];
  // Match bold+italic, bold, italic, inline code, or plain text
  const re = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(md)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: md.slice(lastIndex, match.index) });
    }
    if (match[2]) spans.push({ text: match[2], bold: true, italic: true });
    else if (match[4]) spans.push({ text: match[4], bold: true });
    else if (match[6]) spans.push({ text: match[6], italic: true });
    else if (match[7]) spans.push({ text: match[7] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < md.length) {
    spans.push({ text: md.slice(lastIndex) });
  }
  return spans;
}

/**
 * Render a markdown body string into a pdfkit document.
 * Handles headings, bullet/numbered lists, paragraphs, and inline bold/italic.
 */
function renderMarkdown(
  doc: any,
  markdown: string,
  primaryColor: string,
) {
  const lines = markdown.split("\n");
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Blank line — paragraph break
    if (line.trim() === "") {
      if (inList) { inList = false; }
      doc.moveDown(0.4);
      continue;
    }

    // Headings: ### / ## / #
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? 18 : level === 2 ? 15 : 13;
      doc.moveDown(0.3);
      doc.font("Roboto-Bold").fontSize(fontSize).fillColor(primaryColor)
        .text(stripInlineMarkdown(headingMatch[2]));
      doc.moveDown(0.2);
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      doc.moveDown(0.3);
      const x = (doc as any).x as number;
      const y = (doc as any).y as number;
      doc.save().moveTo(x, y).lineTo(x + 495, y)
        .lineWidth(0.5).strokeColor("#CCCCCC").stroke().restore();
      doc.moveDown(0.3);
      continue;
    }

    // Bullet list item: - or *
    const bulletMatch = line.match(/^\s*[-*+]\s+(.*)/);
    if (bulletMatch) {
      inList = true;
      renderInlineSpans(doc, `\u2022  ${bulletMatch[1]}`, { indent: 10 });
      doc.moveDown(0.15);
      continue;
    }

    // Numbered list item: 1.
    const numMatch = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (numMatch) {
      inList = true;
      renderInlineSpans(doc, `${numMatch[1]}.  ${numMatch[2]}`, { indent: 10 });
      doc.moveDown(0.15);
      continue;
    }

    // Regular paragraph line — render with inline bold/italic
    doc.font("Roboto").fontSize(11).fillColor("#000000");
    renderInlineSpans(doc, line, {});
  }
}

/** Render a single line, switching fonts for bold/italic spans */
function renderInlineSpans(doc: any, line: string, opts: { indent?: number }) {
  const spans = parseMarkdownSpans(line);
  if (spans.length === 0) return;

  // If all plain text, simple render
  if (spans.length === 1 && !spans[0].bold && !spans[0].italic) {
    doc.font("Roboto").fontSize(11).fillColor("#000000")
      .text(spans[0].text, { indent: opts.indent, continued: false });
    return;
  }

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const font = span.bold ? "Roboto-Bold" : span.italic ? "Roboto-Italic" : "Roboto";
    const isLast = i === spans.length - 1;
    doc.font(font).fontSize(11).fillColor("#000000")
      .text(span.text, {
        indent: i === 0 ? opts.indent : undefined,
        continued: !isLast,
      });
  }
}

/** Strip inline markdown markers for contexts where we only want plain text */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/___(.+?)___/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Draw a simple table with header row and body rows using pdfkit */
function drawTable(
  doc: InstanceType<typeof import("pdfkit")>,
  headers: string[],
  rows: string[][],
  contentWidth: number,
  primaryColor: string,
) {
  const colCount = headers.length;
  const colWidth = contentWidth / colCount;
  const ROW_HEIGHT = 22;
  const CELL_PAD = 5;
  const startX = (doc as any).x as number;
  let y = (doc as any).y as number;

  // Ensure enough space for header + at least 1 row; otherwise add page
  if (y + ROW_HEIGHT * 2 > 780) {
    doc.addPage();
    y = 50;
  }

  // Header row
  doc.save();
  doc.rect(startX, y, contentWidth, ROW_HEIGHT).fill(primaryColor);
  doc.font("Roboto-Bold").fontSize(9).fillColor("#FFFFFF");
  for (let c = 0; c < colCount; c++) {
    doc.text(headers[c] ?? "", startX + c * colWidth + CELL_PAD, y + 6, {
      width: colWidth - CELL_PAD * 2,
      lineBreak: false,
    });
  }
  doc.restore();
  y += ROW_HEIGHT;

  // Body rows
  doc.font("Roboto").fontSize(9).fillColor("#000000");
  for (const row of rows) {
    if (y + ROW_HEIGHT > 780) {
      doc.addPage();
      y = 50;
    }
    // Light bottom border
    doc.save();
    doc.moveTo(startX, y + ROW_HEIGHT).lineTo(startX + contentWidth, y + ROW_HEIGHT)
      .lineWidth(0.5).strokeColor("#CCCCCC").stroke();
    doc.restore();
    for (let c = 0; c < colCount; c++) {
      doc.text(row[c] ?? "", startX + c * colWidth + CELL_PAD, y + 6, {
        width: colWidth - CELL_PAD * 2,
        lineBreak: false,
      });
    }
    y += ROW_HEIGHT;
  }

  // Move doc cursor below table
  (doc as any).y = y + 5;
  (doc as any).x = startX;
}
