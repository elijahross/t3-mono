/**
 * Unified LLM Provider Interface
 *
 * Supports: Anthropic, OpenAI, Mistral, Google Gemini, Ollama
 * Features: Automatic logging, model switching, error handling
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LLMLogger } from "../logging";

export type LLMProvider = "anthropic" | "openai" | "mistral" | "google" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  verbose?: boolean;
  baseURL?: string; // For Ollama or custom endpoints
  budgetTokens?: number; // Extended thinking budget (Anthropic only)
}

export interface AnthropicModels {
  "claude-opus-4": "claude-opus-4-20250514";
  "claude-sonnet-4": "claude-sonnet-4-20250514";
  "claude-sonnet-3.5": "claude-3-5-sonnet-20241022";
  "claude-haiku-3": "claude-3-haiku-20240307";
}

export interface OpenAIModels {
  "gpt-4o": "gpt-4o";
  "gpt-4o-mini": "gpt-4o-mini";
  "o1": "o1";
  "o1-mini": "o1-mini";
}

export interface MistralModels {
  "mistral-large": "mistral-large-latest";
  "mistral-small": "mistral-small-latest";
  "mistral-embed": "mistral-embed";
}

export interface GoogleModels {
  "gemini-2.0-flash": "gemini-2.0-flash-exp";
  "gemini-1.5-pro": "gemini-1.5-pro";
  "gemini-1.5-flash": "gemini-1.5-flash";
}

/**
 * Model Registry - Easy access to latest model identifiers
 */
export const ModelRegistry = {
  anthropic: {
    opus: "claude-opus-4-20250514",
    sonnet: "claude-sonnet-4-20250514",
    sonnet35: "claude-3-5-sonnet-20241022",
    haiku: "claude-3-haiku-20240307",
  },
  openai: {
    gpt4o: "gpt-4o",
    gpt4oMini: "gpt-4o-mini",
    o1: "o1",
    o1Mini: "o1-mini",
  },
  mistral: {
    large: "mistral-large-latest",
    small: "mistral-small-latest",
    embed: "mistral-embed",
  },
  google: {
    flash20: "gemini-2.0-flash-exp",
    pro15: "gemini-1.5-pro",
    flash15: "gemini-1.5-flash",
  },
  ollama: {
    llama3: "llama3.2",
    phi: "phi3",
    mistral: "mistral",
  },
} as const;

/**
 * Create LLM instance with unified interface
 */
export function createLLM(config: LLMConfig): BaseChatModel {
  const logger = LLMLogger.getInstance();

  let model: BaseChatModel;

  switch (config.provider) {
    case "anthropic":
      if (config.budgetTokens && config.budgetTokens > 0) {
        // Extended thinking requires temperature=1 and higher maxTokens to accommodate thinking
        model = new ChatAnthropic({
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          model: config.model,
          temperature: 1,
          maxTokens: (config.maxTokens ?? 4096) + config.budgetTokens,
          streaming: config.streaming ?? false,
          thinking: {
            type: "enabled",
            budgetTokens: config.budgetTokens,
          },
        } as any);
      } else {
        model = new ChatAnthropic({
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          model: config.model,
          temperature: config.temperature ?? 1.0,
          maxTokens: config.maxTokens ?? 4096,
          streaming: config.streaming ?? false,
        });
      }
      break;

    case "openai":
      model = new ChatOpenAI({
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
        model: config.model,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 4096,
        streaming: config.streaming ?? false,
      });
      break;

    case "mistral":
      model = new ChatMistralAI({
        apiKey: config.apiKey || process.env.MISTRAL_API_KEY,
        model: config.model,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 4096,
        streaming: config.streaming ?? false,
      });
      break;

    case "google":
      model = new ChatGoogleGenerativeAI({
        apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
        model: config.model,
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxTokens ?? 4096,
        streaming: config.streaming ?? false,
      });
      break;

    case "ollama": {
      const ollamaKey = config.apiKey || process.env.OLLAMA_API_KEY;
      model = new ChatOllama({
        baseUrl: config.baseURL || process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: config.model,
        temperature: config.temperature ?? 0.7,
        ...(ollamaKey ? { headers: { Authorization: `Bearer ${ollamaKey}` } } : {}),
      });
      break;
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }

  // Wrap model with logging if enabled
  if (process.env.LLMLOG) {
    return logger.wrapModel(model, config);
  }

  return model;
}

/**
 * Quick helper functions for common models
 */
export const LLM = {
  // Anthropic
  claude_opus: () => createLLM({
    provider: "anthropic",
    model: ModelRegistry.anthropic.opus,
  }),
  claude_sonnet: () => createLLM({
    provider: "anthropic",
    model: ModelRegistry.anthropic.sonnet,
  }),
  claude_sonnet35: () => createLLM({
    provider: "anthropic",
    model: ModelRegistry.anthropic.sonnet35,
  }),
  claude_haiku: () => createLLM({
    provider: "anthropic",
    model: ModelRegistry.anthropic.haiku,
  }),

  // OpenAI
  gpt4o: () => createLLM({
    provider: "openai",
    model: ModelRegistry.openai.gpt4o,
  }),
  gpt4o_mini: () => createLLM({
    provider: "openai",
    model: ModelRegistry.openai.gpt4oMini,
  }),
  o1: () => createLLM({
    provider: "openai",
    model: ModelRegistry.openai.o1,
  }),

  // Mistral
  mistral_large: () => createLLM({
    provider: "mistral",
    model: ModelRegistry.mistral.large,
  }),
  mistral_small: () => createLLM({
    provider: "mistral",
    model: ModelRegistry.mistral.small,
  }),

  // Google
  gemini_flash: () => createLLM({
    provider: "google",
    model: ModelRegistry.google.flash20,
  }),
  gemini_pro: () => createLLM({
    provider: "google",
    model: ModelRegistry.google.pro15,
  }),

  // Ollama
  llama3: () => createLLM({
    provider: "ollama",
    model: ModelRegistry.ollama.llama3,
  }),
};

/**
 * Multi-provider fallback chain
 * Tries providers in order until one succeeds
 */
export class LLMFallbackChain {
  private configs: LLMConfig[];

  constructor(configs: LLMConfig[]) {
    this.configs = configs;
  }

  async invoke(messages: any[]): Promise<any> {
    let lastError: Error | null = null;

    for (const config of this.configs) {
      try {
        const model = createLLM(config);
        const result = await model.invoke(messages);
        return result;
      } catch (error: any) {
        lastError = error;
        console.warn(`Provider ${config.provider} failed: ${error.message}`);
        continue;
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }
}

/**
 * Cost estimation (approximate, for budgeting)
 */
export const ModelCosts = {
  anthropic: {
    "claude-opus-4-20250514": { input: 15, output: 75 }, // per 1M tokens
    "claude-sonnet-4-20250514": { input: 3, output: 15 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  },
  openai: {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "o1": { input: 15, output: 60 },
    "o1-mini": { input: 3, output: 12 },
  },
  mistral: {
    "mistral-large-latest": { input: 2, output: 6 },
    "mistral-small-latest": { input: 0.2, output: 0.6 },
  },
  google: {
    "gemini-2.0-flash-exp": { input: 0, output: 0 }, // Free preview
    "gemini-1.5-pro": { input: 1.25, output: 5 },
    "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  },
} as const;

export function estimateCost(
  provider: LLMProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = ModelCosts[provider as keyof typeof ModelCosts];
  if (!costs) return 0;

  const modelCosts = costs[model as keyof typeof costs] as { input: number; output: number } | undefined;
  if (!modelCosts) return 0;

  const inputCost = (inputTokens / 1_000_000) * modelCosts.input;
  const outputCost = (outputTokens / 1_000_000) * modelCosts.output;

  return inputCost + outputCost;
}
