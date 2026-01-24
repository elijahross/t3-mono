import * as restate from "@restatedev/restate-sdk";
import { Context } from "@restatedev/restate-sdk";
import { z } from "zod";
import ollama from "ollama";

// Configuration
const config = {
  ollamaEndpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
  defaultModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
  maxRetries: parseInt(process.env.MAX_RETRIES || "5"),
};

// Retry configuration
const retryConfig = {
  initialRetryInterval: { milliseconds: 1500 },
  retryIntervalFactor: 2,
  maxRetryInterval: { seconds: 5 },
  maxRetryAttempts: config.maxRetries,
  maxRetryDuration: { seconds: 30 },
};

// Schemas
const GenerateEmbeddingsInputSchema = z.object({
  texts: z.array(z.string()).min(1).max(100),
  model: z.string().optional(),
  normalize: z.boolean().optional().default(true),
  truncate: z.boolean().optional().default(true),
});

const GenerateEmbeddingInputSchema = z.object({
  text: z.string(),
  model: z.string().optional(),
  normalize: z.boolean().optional().default(true),
  truncate: z.boolean().optional().default(true),
});

type GenerateEmbeddingsInput = z.infer<typeof GenerateEmbeddingsInputSchema>;
type GenerateEmbeddingInput = z.infer<typeof GenerateEmbeddingInputSchema>;

// Utilities
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 ? vector : vector.map(val => val / magnitude);
}

async function generateOllamaEmbedding(
  text: string,
  model: string,
  normalize: boolean,
  truncate: boolean
): Promise<number[]> {
  const client = new ollama.Ollama({ host: config.ollamaEndpoint });
  const response = await client.embeddings({
    model,
    prompt: text,
    options: { truncate },
  });

  let embedding = response.embedding;
  if (normalize) {
    embedding = normalizeVector(embedding);
  }

  return embedding;
}

// Service
export const EmbeddingService = restate.service({
  name: "EmbeddingService",
  handlers: {
    generateEmbeddings: async (ctx: Context, input: GenerateEmbeddingsInput) => {
      const validated = GenerateEmbeddingsInputSchema.parse(input);
      const model = validated.model || config.defaultModel;
      const startTime = Date.now();

      const embeddings: number[][] = [];
      for (const text of validated.texts) {
        const embedding = await ctx.run(
          `embed-${text.substring(0, 50)}`,
          retryConfig,
          async () => generateOllamaEmbedding(text, model, validated.normalize, validated.truncate)
        );
        embeddings.push(embedding);
      }

      const processingTime = Date.now() - startTime;
      const dimensions = embeddings[0]?.length || 0;

      ctx.console.info({
        service: "EmbeddingService",
        action: "generateEmbeddings",
        count: embeddings.length,
        model,
        dimensions,
        processingTime,
      });

      return { embeddings, model, dimensions, processingTime };
    },

    generateEmbedding: async (ctx: Context, input: GenerateEmbeddingInput) => {
      const validated = GenerateEmbeddingInputSchema.parse(input);
      const model = validated.model || config.defaultModel;
      const startTime = Date.now();

      const embedding = await ctx.run("embed-single", retryConfig, async () =>
        generateOllamaEmbedding(validated.text, model, validated.normalize, validated.truncate)
      );

      const processingTime = Date.now() - startTime;

      ctx.console.info({
        service: "EmbeddingService",
        action: "generateEmbedding",
        model,
        dimensions: embedding.length,
        processingTime,
      });

      return { embedding, model, dimensions: embedding.length, processingTime };
    },

    health: async (ctx: Context) => {
      try {
        await ctx.run("health-check", async () => {
          const client = new ollama.Ollama({ host: config.ollamaEndpoint });
          await client.embeddings({ model: config.defaultModel, prompt: "test" });
        });
        return { status: "healthy", model: config.defaultModel };
      } catch (error: any) {
        ctx.console.error("EmbeddingService health check failed", error);
        return { status: "unhealthy", model: config.defaultModel };
      }
    },

    listModels: async (ctx: Context) => {
      const models = await ctx.run("list-models", async () => {
        const client = new ollama.Ollama({ host: config.ollamaEndpoint });
        const response = await client.list();
        return response.models.map((m: any) => m.name);
      });
      return { models };
    },
  },
});
