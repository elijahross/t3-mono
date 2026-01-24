import * as restate from "@restatedev/restate-sdk";
import { Context } from "@restatedev/restate-sdk";
import { z } from "zod";
import axios from "axios";

// Configuration
const config = {
  doclingEndpoint: process.env.DOCLING_ENDPOINT || "http://localhost:5000",
  timeout: parseInt(process.env.EXTRACTION_TIMEOUT || "60000"),
  maxRetries: parseInt(process.env.MAX_RETRIES || "5"),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "104857600"), // 100MB
};

// Retry configuration
const retryConfig = {
  initialRetryInterval: { milliseconds: 2000 },
  retryIntervalFactor: 2,
  maxRetryInterval: { seconds: 10 },
  maxRetryAttempts: config.maxRetries,
  maxRetryDuration: { minutes: 5 },
};

// Schemas
const DocumentFormatSchema = z.enum(["markdown", "json", "html", "text", "doctran"]);

const ExtractDocumentInputSchema = z.object({
  url: z.string(),
  format: DocumentFormatSchema.optional().default("markdown"),
  extractImages: z.boolean().optional().default(true),
  extractTables: z.boolean().optional().default(true),
  ocrEnabled: z.boolean().optional().default(false),
});

const ExtractFromBufferInputSchema = z.object({
  content: z.string(),
  filename: z.string(),
  format: DocumentFormatSchema.optional().default("markdown"),
  extractImages: z.boolean().optional().default(true),
  extractTables: z.boolean().optional().default(true),
  ocrEnabled: z.boolean().optional().default(false),
});

type ExtractDocumentInput = z.infer<typeof ExtractDocumentInputSchema>;
type ExtractFromBufferInput = z.infer<typeof ExtractFromBufferInputSchema>;

// Docling Client
class DoclingClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async extract(documentUrl: string, options: any) {
    const response = await axios.post(
      `${this.baseUrl}/convert`,
      {
        url: documentUrl,
        output_format: options.format,
        extract_images: options.extractImages,
        extract_tables: options.extractTables,
        ocr: options.ocrEnabled,
      },
      { timeout: config.timeout, maxContentLength: config.maxFileSize }
    );
    return this.parseResponse(response.data);
  }

  async extractFromBuffer(content: Buffer, filename: string, options: any) {
    const formData = new FormData();
    const blob = new Blob([content], { type: this.getMimeType(filename) });
    formData.append("file", blob, filename);
    formData.append("output_format", options.format);
    formData.append("extract_images", String(options.extractImages));
    formData.append("extract_tables", String(options.extractTables));
    formData.append("ocr", String(options.ocrEnabled));

    const response = await axios.post(`${this.baseUrl}/convert`, formData, {
      timeout: config.timeout,
      maxContentLength: config.maxFileSize,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return this.parseResponse(response.data);
  }

  private parseResponse(data: any) {
    return {
      content: data.content || data.text || "",
      format: data.format || "markdown",
      metadata: {
        pageCount: data.metadata?.page_count,
        images: data.images?.map((img: any, index: number) => ({
          index,
          width: img.width,
          height: img.height,
          format: img.format,
          data: img.data,
        })),
        tables: data.tables?.map((table: any, index: number) => ({
          index,
          rows: table.rows,
          columns: table.columns,
          content: table.data,
        })),
        language: data.metadata?.language,
        author: data.metadata?.author,
        title: data.metadata?.title,
      },
      processingTime: data.processing_time || 0,
    };
  }

  private getMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      html: "text/html",
      xml: "application/xml",
      txt: "text/plain",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }
}

// Service
export const ExtractionService = restate.service({
  name: "ExtractionService",
  handlers: {
    extractDocument: async (ctx: Context, input: ExtractDocumentInput) => {
      const validated = ExtractDocumentInputSchema.parse(input);
      const startTime = Date.now();

      const result = await ctx.run(`extract-${validated.url}`, retryConfig, async () => {
        const client = new DoclingClient(config.doclingEndpoint);
        return await client.extract(validated.url, validated);
      });

      const totalTime = Date.now() - startTime;

      ctx.console.info({
        service: "ExtractionService",
        action: "extractDocument",
        url: validated.url,
        format: validated.format,
        pageCount: result.metadata.pageCount,
        processingTime: totalTime,
      });

      return result;
    },

    extractFromBuffer: async (ctx: Context, input: ExtractFromBufferInput) => {
      const validated = ExtractFromBufferInputSchema.parse(input);
      const startTime = Date.now();

      const result = await ctx.run(`extract-buffer-${validated.filename}`, retryConfig, async () => {
        const client = new DoclingClient(config.doclingEndpoint);
        const buffer = Buffer.from(validated.content, "base64");
        return await client.extractFromBuffer(buffer, validated.filename, validated);
      });

      const totalTime = Date.now() - startTime;

      ctx.console.info({
        service: "ExtractionService",
        action: "extractFromBuffer",
        filename: validated.filename,
        processingTime: totalTime,
      });

      return result;
    },

    extractText: async (ctx: Context, input: { url: string }) => {
      const result = await ctx.serviceClient(ExtractionService).extractDocument({
        url: input.url,
        format: "text",
        extractImages: false,
        extractTables: false,
        ocrEnabled: false,
      });
      return { text: result.content };
    },

    extractWithOCR: async (ctx: Context, input: { url: string; format?: string }) => {
      return await ctx.serviceClient(ExtractionService).extractDocument({
        url: input.url,
        format: (input.format as any) || "markdown",
        extractImages: true,
        extractTables: true,
        ocrEnabled: true,
      });
    },

    health: async (ctx: Context) => {
      try {
        await ctx.run("health-check", async () => {
          await axios.get(`${config.doclingEndpoint}/health`, { timeout: 5000 });
        });
        return { status: "healthy" };
      } catch (error: any) {
        ctx.console.error("ExtractionService health check failed", error);
        return { status: "unhealthy" };
      }
    },
  },
});
