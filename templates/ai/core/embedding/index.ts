/**
 * Embedding Module
 *
 * Supports multiple embedding providers:
 * - OpenAI (text-embedding-3-small, text-embedding-3-large)
 * - Mistral (mistral-embed)
 * - Google (text-embedding-004)
 * - Cohere (embed-english-v3.0, embed-multilingual-v3.0)
 * - Ollama (local models)
 */

import { OpenAIEmbeddings } from "@langchain/openai";
import { MistralAIEmbeddings } from "@langchain/mistralai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { CohereEmbeddings } from "@langchain/cohere";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Embeddings } from "@langchain/core/embeddings";

export type EmbeddingProvider = "openai" | "mistral" | "google" | "cohere" | "ollama";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey?: string;
  batchSize?: number;
  stripNewLines?: boolean;
  baseURL?: string; // For Ollama
  dimensions?: number; // For OpenAI
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
  provider: string;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  dimensions: number;
  model: string;
  provider: string;
  count: number;
}

/**
 * Embedding Model Registry
 */
export const EmbeddingModels = {
  openai: {
    small: "text-embedding-3-small", // 1536 dimensions
    large: "text-embedding-3-large", // 3072 dimensions
    ada: "text-embedding-ada-002", // 1536 dimensions (legacy)
  },
  mistral: {
    embed: "mistral-embed", // 1024 dimensions
  },
  google: {
    latest: "text-embedding-004", // 768 dimensions
    gecko: "text-embedding-gecko-001", // 768 dimensions
  },
  cohere: {
    english: "embed-english-v3.0", // 1024 dimensions
    multilingual: "embed-multilingual-v3.0", // 1024 dimensions
    light: "embed-english-light-v3.0", // 384 dimensions
  },
  ollama: {
    nomic: "nomic-embed-text", // 768 dimensions
    mxbai: "mxbai-embed-large", // 1024 dimensions
    allminilm: "all-minilm", // 384 dimensions
  },
} as const;

/**
 * Create embedding instance with unified interface
 */
export function createEmbedding(config: EmbeddingConfig): Embeddings {
  switch (config.provider) {
    case "openai":
      return new OpenAIEmbeddings({
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
        model: config.model,
        stripNewLines: config.stripNewLines ?? true,
        batchSize: config.batchSize ?? 512,
        dimensions: config.dimensions,
      });

    case "mistral":
      return new MistralAIEmbeddings({
        apiKey: config.apiKey || process.env.MISTRAL_API_KEY,
        model: config.model,
      });

    case "google":
      return new GoogleGenerativeAIEmbeddings({
        apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
        model: config.model,
      });

    case "cohere":
      return new CohereEmbeddings({
        apiKey: config.apiKey || process.env.COHERE_API_KEY,
        model: config.model,
      });

    case "ollama":
      return new OllamaEmbeddings({
        baseUrl: config.baseURL || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: config.model,
      });

    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`);
  }
}

/**
 * Unified Embedding Interface
 */
export class EmbeddingGenerator {
  private embeddings: Embeddings;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.embeddings = createEmbedding(config);
  }

  /**
   * Generate single embedding
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const embedding = await this.embeddings.embedQuery(text);

    return {
      embedding,
      dimensions: embedding.length,
      model: this.config.model,
      provider: this.config.provider,
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings = await this.embeddings.embedDocuments(texts);

    return {
      embeddings,
      dimensions: embeddings[0]?.length || 0,
      model: this.config.model,
      provider: this.config.provider,
      count: embeddings.length,
    };
  }

  /**
   * Normalize embeddings to unit length
   */
  normalize(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? embedding : embedding.map((val) => val / magnitude);
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same dimensions");
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

/**
 * Preset configurations
 */
export const EmbeddingPresets = {
  // High quality, expensive
  premium: {
    provider: "openai" as EmbeddingProvider,
    model: EmbeddingModels.openai.large,
  },

  // Balanced quality and cost
  balanced: {
    provider: "openai" as EmbeddingProvider,
    model: EmbeddingModels.openai.small,
  },

  // Fast, cheap
  fast: {
    provider: "ollama" as EmbeddingProvider,
    model: EmbeddingModels.ollama.nomic,
  },

  // Multilingual
  multilingual: {
    provider: "cohere" as EmbeddingProvider,
    model: EmbeddingModels.cohere.multilingual,
  },

  // Local (privacy-focused)
  local: {
    provider: "ollama" as EmbeddingProvider,
    model: EmbeddingModels.ollama.nomic,
    baseURL: "http://localhost:11434",
  },
};

/**
 * Embedding cost estimation (per 1M tokens)
 */
export const EmbeddingCosts = {
  openai: {
    "text-embedding-3-small": 0.02,
    "text-embedding-3-large": 0.13,
    "text-embedding-ada-002": 0.10,
  },
  mistral: {
    "mistral-embed": 0.10,
  },
  google: {
    "text-embedding-004": 0.00, // Free for now
  },
  cohere: {
    "embed-english-v3.0": 0.10,
    "embed-multilingual-v3.0": 0.10,
    "embed-english-light-v3.0": 0.10,
  },
  ollama: {
    // Local models are free
    "nomic-embed-text": 0.00,
    "mxbai-embed-large": 0.00,
    "all-minilm": 0.00,
  },
} as const;

/**
 * Helper: Quick embedding generators
 */
export const Embedding = {
  // OpenAI
  openai_small: () =>
    new EmbeddingGenerator({
      provider: "openai",
      model: EmbeddingModels.openai.small,
    }),

  openai_large: () =>
    new EmbeddingGenerator({
      provider: "openai",
      model: EmbeddingModels.openai.large,
    }),

  // Mistral
  mistral: () =>
    new EmbeddingGenerator({
      provider: "mistral",
      model: EmbeddingModels.mistral.embed,
    }),

  // Google
  google: () =>
    new EmbeddingGenerator({
      provider: "google",
      model: EmbeddingModels.google.latest,
    }),

  // Cohere
  cohere_multilingual: () =>
    new EmbeddingGenerator({
      provider: "cohere",
      model: EmbeddingModels.cohere.multilingual,
    }),

  // Ollama (local)
  ollama_nomic: () =>
    new EmbeddingGenerator({
      provider: "ollama",
      model: EmbeddingModels.ollama.nomic,
    }),
};

/**
 * Batch processor for large datasets
 */
export class BatchEmbeddingProcessor {
  private generator: EmbeddingGenerator;
  private batchSize: number;

  constructor(generator: EmbeddingGenerator, batchSize: number = 100) {
    this.generator = generator;
    this.batchSize = batchSize;
  }

  async process(
    texts: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<number[][]> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const result = await this.generator.embedBatch(batch);
      allEmbeddings.push(...result.embeddings);

      if (onProgress) {
        onProgress(Math.min(i + this.batchSize, texts.length), texts.length);
      }
    }

    return allEmbeddings;
  }
}

/**
 * Semantic search helper
 */
export class SemanticSearch {
  private generator: EmbeddingGenerator;
  private corpus: { text: string; embedding: number[]; metadata?: any }[];

  constructor(generator: EmbeddingGenerator) {
    this.generator = generator;
    this.corpus = [];
  }

  /**
   * Index documents
   */
  async index(documents: { text: string; metadata?: any }[]): Promise<void> {
    const texts = documents.map((d) => d.text);
    const result = await this.generator.embedBatch(texts);

    this.corpus = documents.map((doc, i) => ({
      text: doc.text,
      embedding: result.embeddings[i],
      metadata: doc.metadata,
    }));
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    topK: number = 5,
    threshold: number = 0.5
  ): Promise<{ text: string; score: number; metadata?: any }[]> {
    const queryResult = await this.generator.embed(query);
    const queryEmbedding = queryResult.embedding;

    const results = this.corpus
      .map((doc) => ({
        text: doc.text,
        score: this.generator.cosineSimilarity(queryEmbedding, doc.embedding),
        metadata: doc.metadata,
      }))
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }
}
