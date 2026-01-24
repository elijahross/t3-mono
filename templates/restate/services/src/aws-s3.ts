import * as restate from "@restatedev/restate-sdk";
import { Context } from "@restatedev/restate-sdk";
import { z } from "zod";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import * as path from "path";

// Configuration
const config = {
  bucketName: process.env.AWS_S3_BUCKET_NAME || "",
  region: process.env.AWS_REGION || "us-east-1",
  maxRetries: parseInt(process.env.MAX_RETRIES || "5"),
  presignedUrlExpiry: parseInt(process.env.PRESIGNED_URL_EXPIRY || "3600"), // 1 hour
};

const s3Client = new S3Client({ region: config.region });

// Retry configuration
const retryConfig = {
  initialRetryInterval: { milliseconds: 1000 },
  retryIntervalFactor: 2,
  maxRetryInterval: { seconds: 5 },
  maxRetryAttempts: config.maxRetries,
  maxRetryDuration: { seconds: 30 },
};

// Schemas
const GetPresignedUrlInputSchema = z.object({
  key: z.string(),
  bucket: z.string().optional(),
  expiresIn: z.number().optional(),
});

const UploadFileInputSchema = z.object({
  key: z.string(),
  filePath: z.string(),
  bucket: z.string().optional(),
  contentType: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const UploadBufferInputSchema = z.object({
  key: z.string(),
  content: z.string(), // base64
  bucket: z.string().optional(),
  contentType: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const DownloadFileInputSchema = z.object({
  key: z.string(),
  bucket: z.string().optional(),
  destination: z.string(),
});

const DownloadBufferInputSchema = z.object({
  key: z.string(),
  bucket: z.string().optional(),
});

const DeleteFileInputSchema = z.object({
  key: z.string(),
  bucket: z.string().optional(),
});

const ListFilesInputSchema = z.object({
  prefix: z.string().optional(),
  bucket: z.string().optional(),
  maxKeys: z.number().optional().default(1000),
});

type GetPresignedUrlInput = z.infer<typeof GetPresignedUrlInputSchema>;
type UploadFileInput = z.infer<typeof UploadFileInputSchema>;
type UploadBufferInput = z.infer<typeof UploadBufferInputSchema>;
type DownloadFileInput = z.infer<typeof DownloadFileInputSchema>;
type DownloadBufferInput = z.infer<typeof DownloadBufferInputSchema>;
type DeleteFileInput = z.infer<typeof DeleteFileInputSchema>;
type ListFilesInput = z.infer<typeof ListFilesInputSchema>;

// Service
export const AWSS3Service = restate.service({
  name: "AWSS3Service",
  handlers: {
    getPresignedUrl: async (ctx: Context, input: GetPresignedUrlInput) => {
      const validated = GetPresignedUrlInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      const url = await ctx.run("get-presigned-url", retryConfig, async () => {
        const command = new GetObjectCommand({ Bucket: bucket, Key: validated.key });
        return await getSignedUrl(s3Client, command, {
          expiresIn: validated.expiresIn || config.presignedUrlExpiry,
        });
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "getPresignedUrl",
        key: validated.key,
        bucket,
      });

      return { url, expiresIn: validated.expiresIn || config.presignedUrlExpiry };
    },

    getUploadPresignedUrl: async (ctx: Context, input: GetPresignedUrlInput) => {
      const validated = GetPresignedUrlInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      const url = await ctx.run("get-upload-presigned-url", retryConfig, async () => {
        const command = new PutObjectCommand({ Bucket: bucket, Key: validated.key });
        return await getSignedUrl(s3Client, command, {
          expiresIn: validated.expiresIn || config.presignedUrlExpiry,
        });
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "getUploadPresignedUrl",
        key: validated.key,
        bucket,
      });

      return { url, expiresIn: validated.expiresIn || config.presignedUrlExpiry };
    },

    uploadFile: async (ctx: Context, input: UploadFileInput) => {
      const validated = UploadFileInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      const result = await ctx.run("upload-file", retryConfig, async () => {
        const fileContent = fs.readFileSync(validated.filePath);
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: validated.key,
          Body: fileContent,
          ContentType: validated.contentType,
          Metadata: validated.metadata,
        });
        await s3Client.send(command);
        return { size: fileContent.length };
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "uploadFile",
        key: validated.key,
        bucket,
        size: result.size,
      });

      return { key: validated.key, bucket, size: result.size };
    },

    uploadBuffer: async (ctx: Context, input: UploadBufferInput) => {
      const validated = UploadBufferInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      const result = await ctx.run("upload-buffer", retryConfig, async () => {
        const buffer = Buffer.from(validated.content, "base64");
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: validated.key,
          Body: buffer,
          ContentType: validated.contentType,
          Metadata: validated.metadata,
        });
        await s3Client.send(command);
        return { size: buffer.length };
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "uploadBuffer",
        key: validated.key,
        bucket,
        size: result.size,
      });

      return { key: validated.key, bucket, size: result.size };
    },

    downloadFile: async (ctx: Context, input: DownloadFileInput) => {
      const validated = DownloadFileInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      await ctx.run("download-file", retryConfig, async () => {
        const command = new GetObjectCommand({ Bucket: bucket, Key: validated.key });
        const response = await s3Client.send(command);
        const dir = path.dirname(validated.destination);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const writeStream = fs.createWriteStream(validated.destination);
        await new Promise((resolve, reject) => {
          (response.Body as any).pipe(writeStream);
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "downloadFile",
        key: validated.key,
        bucket,
        destination: validated.destination,
      });

      return { key: validated.key, destination: validated.destination };
    },

    downloadFileToBuffer: async (ctx: Context, input: DownloadBufferInput) => {
      const validated = DownloadBufferInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      const buffer = await ctx.run("download-buffer", retryConfig, async () => {
        const command = new GetObjectCommand({ Bucket: bucket, Key: validated.key });
        const response = await s3Client.send(command);
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "downloadFileToBuffer",
        key: validated.key,
        bucket,
        size: buffer.length,
      });

      return { content: buffer.toString("base64"), size: buffer.length };
    },

    deleteFile: async (ctx: Context, input: DeleteFileInput) => {
      const validated = DeleteFileInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      await ctx.run("delete-file", retryConfig, async () => {
        const command = new DeleteObjectCommand({ Bucket: bucket, Key: validated.key });
        await s3Client.send(command);
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "deleteFile",
        key: validated.key,
        bucket,
      });

      return { key: validated.key, deleted: true };
    },

    listFiles: async (ctx: Context, input: ListFilesInput) => {
      const validated = ListFilesInputSchema.parse(input);
      const bucket = validated.bucket || config.bucketName;

      const files = await ctx.run("list-files", retryConfig, async () => {
        const command = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: validated.prefix,
          MaxKeys: validated.maxKeys,
        });
        const response = await s3Client.send(command);
        return (
          response.Contents?.map((item) => ({
            key: item.Key || "",
            size: item.Size || 0,
            lastModified: item.LastModified?.toISOString() || "",
          })) || []
        );
      });

      ctx.console.info({
        service: "AWSS3Service",
        action: "listFiles",
        bucket,
        prefix: validated.prefix,
        count: files.length,
      });

      return { files, count: files.length };
    },

    getFileMetadata: async (ctx: Context, input: { key: string; bucket?: string }) => {
      const bucket = input.bucket || config.bucketName;

      const metadata = await ctx.run("get-metadata", retryConfig, async () => {
        const command = new HeadObjectCommand({ Bucket: bucket, Key: input.key });
        const response = await s3Client.send(command);
        return {
          contentType: response.ContentType,
          contentLength: response.ContentLength,
          lastModified: response.LastModified?.toISOString(),
          metadata: response.Metadata,
          etag: response.ETag,
        };
      });

      return metadata;
    },

    health: async (ctx: Context) => {
      try {
        await ctx.run("health-check", async () => {
          const command = new ListObjectsV2Command({
            Bucket: config.bucketName,
            MaxKeys: 1,
          });
          await s3Client.send(command);
        });
        return { status: "healthy", bucket: config.bucketName };
      } catch (error: any) {
        ctx.console.error("AWSS3Service health check failed", error);
        return { status: "unhealthy", bucket: config.bucketName };
      }
    },
  },
});
