/**
 * Text Chunking Module
 *
 * Supports multiple chunking strategies:
 * - Character-based (simple)
 * - Token-based (respects token limits)
 * - Semantic (paragraph/sentence boundaries)
 * - Recursive (hierarchical chunking)
 * - Markdown-aware (preserves structure)
 */

import { RecursiveCharacterTextSplitter, CharacterTextSplitter } from "langchain/text_splitter";
import { TokenTextSplitter } from "langchain/text_splitter";
import { MarkdownTextSplitter } from "@langchain/textsplitters";

export type ChunkingStrategy =
  | "character"
  | "token"
  | "semantic"
  | "recursive"
  | "markdown";

export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  separator?: string;
  keepSeparator?: boolean;
}

export interface Chunk {
  content: string;
  index: number;
  metadata?: Record<string, any>;
}

/**
 * Unified chunking interface
 */
export class TextChunker {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      strategy: config.strategy || "recursive",
      chunkSize: config.chunkSize || 1000,
      chunkOverlap: config.chunkOverlap || 200,
      separator: config.separator,
      keepSeparator: config.keepSeparator ?? true,
    };
  }

  /**
   * Chunk text based on configured strategy
   */
  async chunk(text: string, metadata?: Record<string, any>): Promise<Chunk[]> {
    let splitter;

    switch (this.config.strategy) {
      case "character":
        splitter = new CharacterTextSplitter({
          separator: this.config.separator || "\n\n",
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
        });
        break;

      case "token":
        splitter = new TokenTextSplitter({
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
        });
        break;

      case "semantic":
        // Semantic chunking uses sentence boundaries
        splitter = new RecursiveCharacterTextSplitter({
          separators: ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "],
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
          keepSeparator: this.config.keepSeparator,
        });
        break;

      case "recursive":
        // Hierarchical chunking (paragraphs → sentences → words)
        splitter = new RecursiveCharacterTextSplitter({
          separators: ["\n\n", "\n", " ", ""],
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
          keepSeparator: this.config.keepSeparator,
        });
        break;

      case "markdown":
        splitter = new MarkdownTextSplitter({
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
        });
        break;

      default:
        throw new Error(`Unknown chunking strategy: ${this.config.strategy}`);
    }

    const texts = await splitter.splitText(text);

    return texts.map((content, index) => ({
      content,
      index,
      metadata: {
        ...metadata,
        chunkStrategy: this.config.strategy,
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
        totalChunks: texts.length,
      },
    }));
  }

  /**
   * Chunk documents (array of texts)
   */
  async chunkDocuments(
    documents: { content: string; metadata?: Record<string, any> }[]
  ): Promise<Chunk[]> {
    const allChunks: Chunk[] = [];
    let globalIndex = 0;

    for (const doc of documents) {
      const chunks = await this.chunk(doc.content, doc.metadata);

      // Reindex chunks globally
      for (const chunk of chunks) {
        allChunks.push({
          ...chunk,
          index: globalIndex++,
        });
      }
    }

    return allChunks;
  }
}

/**
 * Preset configurations for common use cases
 */
export const ChunkingPresets = {
  // Small chunks for precise retrieval
  precise: {
    strategy: "recursive" as ChunkingStrategy,
    chunkSize: 500,
    chunkOverlap: 100,
  },

  // Medium chunks for balanced retrieval
  balanced: {
    strategy: "recursive" as ChunkingStrategy,
    chunkSize: 1000,
    chunkOverlap: 200,
  },

  // Large chunks for context-rich retrieval
  contextual: {
    strategy: "recursive" as ChunkingStrategy,
    chunkSize: 2000,
    chunkOverlap: 400,
  },

  // Markdown documents
  markdown: {
    strategy: "markdown" as ChunkingStrategy,
    chunkSize: 1000,
    chunkOverlap: 200,
  },

  // Code documents
  code: {
    strategy: "character" as ChunkingStrategy,
    chunkSize: 1500,
    chunkOverlap: 300,
    separator: "\n\n",
  },

  // Semantic (sentence-aware)
  semantic: {
    strategy: "semantic" as ChunkingStrategy,
    chunkSize: 800,
    chunkOverlap: 150,
  },

  // Token-limited (for LLM context windows)
  tokenLimited: {
    strategy: "token" as ChunkingStrategy,
    chunkSize: 512,
    chunkOverlap: 50,
  },
};

/**
 * Advanced: Sliding window chunker
 * Creates overlapping windows for better context preservation
 */
export class SlidingWindowChunker {
  private windowSize: number;
  private stride: number;

  constructor(windowSize: number = 1000, stride: number = 500) {
    this.windowSize = windowSize;
    this.stride = stride;
  }

  chunk(text: string, metadata?: Record<string, any>): Chunk[] {
    const chunks: Chunk[] = [];
    let index = 0;

    for (let i = 0; i < text.length; i += this.stride) {
      const chunk = text.slice(i, i + this.windowSize);

      if (chunk.length < this.windowSize / 2) {
        // Skip very small last chunks
        break;
      }

      chunks.push({
        content: chunk,
        index: index++,
        metadata: {
          ...metadata,
          windowSize: this.windowSize,
          stride: this.stride,
          startOffset: i,
          endOffset: i + chunk.length,
        },
      });
    }

    return chunks;
  }
}

/**
 * Advanced: Hierarchical chunker
 * Creates chunks at multiple levels (document → section → paragraph)
 */
export class HierarchicalChunker {
  async chunk(
    text: string,
    metadata?: Record<string, any>
  ): Promise<{
    sections: Chunk[];
    paragraphs: Chunk[];
    sentences: Chunk[];
  }> {
    // Level 1: Sections (split by double newlines)
    const sectionSplitter = new CharacterTextSplitter({
      separator: "\n\n",
      chunkSize: 4000,
      chunkOverlap: 200,
    });
    const sectionTexts = await sectionSplitter.splitText(text);
    const sections = sectionTexts.map((content, index) => ({
      content,
      index,
      metadata: { ...metadata, level: "section" },
    }));

    // Level 2: Paragraphs
    const paragraphSplitter = new RecursiveCharacterTextSplitter({
      separators: ["\n\n", "\n"],
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const paragraphTexts = await paragraphSplitter.splitText(text);
    const paragraphs = paragraphTexts.map((content, index) => ({
      content,
      index,
      metadata: { ...metadata, level: "paragraph" },
    }));

    // Level 3: Sentences
    const sentenceSplitter = new RecursiveCharacterTextSplitter({
      separators: [". ", "! ", "? ", "\n"],
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const sentenceTexts = await sentenceSplitter.splitText(text);
    const sentences = sentenceTexts.map((content, index) => ({
      content,
      index,
      metadata: { ...metadata, level: "sentence" },
    }));

    return { sections, paragraphs, sentences };
  }
}

/**
 * Utility: Chunk quality metrics
 */
export function analyzeChunks(chunks: Chunk[]): {
  totalChunks: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  totalCharacters: number;
} {
  const sizes = chunks.map((c) => c.content.length);

  return {
    totalChunks: chunks.length,
    avgChunkSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
    minChunkSize: Math.min(...sizes),
    maxChunkSize: Math.max(...sizes),
    totalCharacters: sizes.reduce((a, b) => a + b, 0),
  };
}

/**
 * Utility: Merge small chunks
 */
export function mergeSmallChunks(chunks: Chunk[], minSize: number = 100): Chunk[] {
  const merged: Chunk[] = [];
  let buffer = "";
  let bufferMetadata: Record<string, any> = {};

  for (const chunk of chunks) {
    if (chunk.content.length < minSize && buffer.length > 0) {
      buffer += " " + chunk.content;
    } else {
      if (buffer) {
        merged.push({
          content: buffer,
          index: merged.length,
          metadata: bufferMetadata,
        });
      }
      buffer = chunk.content;
      bufferMetadata = chunk.metadata || {};
    }
  }

  if (buffer) {
    merged.push({
      content: buffer,
      index: merged.length,
      metadata: bufferMetadata,
    });
  }

  return merged;
}
