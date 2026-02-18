/**
 * Standalone Docling HTTP client for Next.js server-side extraction.
 * Extracted from restate/services/src/extraction.ts DoclingClient.
 */

const DOCLING_ENDPOINT = process.env.DOCLING_ENDPOINT || "http://localhost:5001";
const DOCLING_API_KEY = process.env.DOCLING_API_KEY || "";
const EXTRACTION_TIMEOUT = parseInt(process.env.EXTRACTION_TIMEOUT || "120000");

interface DoclingResult {
  content: string;
}

/**
 * Extract document content from a presigned S3 URL via Docling.
 */
export async function extractFromUrl(url: string): Promise<DoclingResult> {
  const response = await fetch(`${DOCLING_ENDPOINT}/v1/convert/source`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(DOCLING_API_KEY && { "X-Api-Key": `${DOCLING_API_KEY}` }),
    },
    body: JSON.stringify({
      sources: [{ kind: "http", url }],
      options: {
        to_formats: ["md"],
        do_ocr: true,
        image_export_mode: "placeholder",
        do_table_structure: true,
      },
    }),
    signal: AbortSignal.timeout(EXTRACTION_TIMEOUT),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Docling extraction failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const doc = data.document || {};
  const content = doc.md_content || "";

  return { content };
}
