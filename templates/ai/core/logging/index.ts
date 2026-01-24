/**
 * LLM Call Logging System
 *
 * Supports: Terminal, Database, File logging
 * Controlled by: LLMLOG environment variable
 *
 * Usage:
 *   LLMLOG=terminal    - Log to console
 *   LLMLOG=database    - Log to PostgreSQL
 *   LLMLOG=file        - Log to file
 *   LLMLOG=all         - Log to all destinations
 */

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage } from "@langchain/core/messages";
import * as winston from "winston";
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

export interface LLMLogEntry {
  timestamp: string;
  provider: string;
  model: string;
  messages: any[];
  response: any;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export type LogDestination = "terminal" | "database" | "file" | "all";

/**
 * Singleton LLM Logger
 */
export class LLMLogger {
  private static instance: LLMLogger | null = null;
  private destination: LogDestination | null = null;
  private logger: winston.Logger;
  private dbPool: Pool | null = null;
  private logFilePath: string;

  private constructor() {
    // Parse LLMLOG env var
    const llmlog = process.env.LLMLOG?.toLowerCase();
    this.destination = (llmlog as LogDestination) || null;

    // Setup log file path
    const logDir = process.env.LLMLOG_DIR || path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, "llm-calls.jsonl");

    // Setup Winston logger for terminal/file
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [],
    });

    // Configure transports based on destination
    if (this.shouldLogToTerminal()) {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf((info) => {
              const { timestamp, provider, model, inputTokens, outputTokens, latencyMs, cost } = info;
              return `${timestamp} [LLM] ${provider}/${model} | In: ${inputTokens} Out: ${outputTokens} | ${latencyMs}ms | $${cost?.toFixed(4) || "0.0000"}`;
            })
          ),
        })
      );
    }

    if (this.shouldLogToFile()) {
      this.logger.add(
        new winston.transports.File({
          filename: this.logFilePath,
          format: winston.format.json(),
        })
      );
    }

    // Setup database connection
    if (this.shouldLogToDatabase()) {
      this.initDatabase();
    }
  }

  static getInstance(): LLMLogger {
    if (!LLMLogger.instance) {
      LLMLogger.instance = new LLMLogger();
    }
    return LLMLogger.instance;
  }

  private shouldLogToTerminal(): boolean {
    return this.destination === "terminal" || this.destination === "all";
  }

  private shouldLogToFile(): boolean {
    return this.destination === "file" || this.destination === "all";
  }

  private shouldLogToDatabase(): boolean {
    return this.destination === "database" || this.destination === "all";
  }

  private async initDatabase() {
    const connectionString = process.env.DATABASE_URL || process.env.LLMLOG_DATABASE_URL;
    if (!connectionString) {
      console.warn("LLMLOG=database but no DATABASE_URL found. Skipping database logging.");
      return;
    }

    this.dbPool = new Pool({ connectionString });

    // Create table if not exists
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS llm_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        messages JSONB NOT NULL,
        response JSONB,
        input_tokens INTEGER,
        output_tokens INTEGER,
        total_tokens INTEGER,
        latency_ms INTEGER,
        cost DECIMAL(10, 6),
        error TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_llm_logs_timestamp ON llm_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_llm_logs_provider ON llm_logs(provider);
      CREATE INDEX IF NOT EXISTS idx_llm_logs_model ON llm_logs(model);
    `;

    try {
      await this.dbPool.query(createTableSQL);
    } catch (error: any) {
      console.error("Failed to create llm_logs table:", error.message);
    }
  }

  async log(entry: LLMLogEntry): Promise<void> {
    if (!this.destination) return;

    // Log to terminal/file
    if (this.shouldLogToTerminal() || this.shouldLogToFile()) {
      this.logger.info(entry);
    }

    // Log to database
    if (this.shouldLogToDatabase() && this.dbPool) {
      try {
        await this.dbPool.query(
          `INSERT INTO llm_logs
           (timestamp, provider, model, messages, response, input_tokens, output_tokens, total_tokens, latency_ms, cost, error, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            entry.timestamp,
            entry.provider,
            entry.model,
            JSON.stringify(entry.messages),
            JSON.stringify(entry.response),
            entry.inputTokens,
            entry.outputTokens,
            entry.totalTokens,
            entry.latencyMs,
            entry.cost,
            entry.error,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
          ]
        );
      } catch (error: any) {
        console.error("Failed to log to database:", error.message);
      }
    }
  }

  /**
   * Wrap a model to automatically log all calls
   */
  wrapModel(model: BaseChatModel, config: any): BaseChatModel {
    const originalInvoke = model.invoke.bind(model);
    const logger = this;

    model.invoke = async function (input: any, options?: any) {
      const startTime = Date.now();
      let response: any;
      let error: string | undefined;

      try {
        response = await originalInvoke(input, options);
      } catch (err: any) {
        error = err.message;
        throw err;
      } finally {
        const latencyMs = Date.now() - startTime;

        // Extract token usage
        const inputTokens = response?.usage_metadata?.input_tokens || 0;
        const outputTokens = response?.usage_metadata?.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;

        // Calculate cost (if available)
        let cost: number | undefined;
        if (config.provider && config.model) {
          cost = estimateCost(config.provider, config.model, inputTokens, outputTokens);
        }

        const logEntry: LLMLogEntry = {
          timestamp: new Date().toISOString(),
          provider: config.provider || "unknown",
          model: config.model || "unknown",
          messages: Array.isArray(input) ? input : [input],
          response: response?.content || response,
          inputTokens,
          outputTokens,
          totalTokens,
          latencyMs,
          cost,
          error,
        };

        await logger.log(logEntry);
      }

      return response;
    };

    return model;
  }

  /**
   * Query logs from database
   */
  async queryLogs(options: {
    provider?: string;
    model?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<LLMLogEntry[]> {
    if (!this.dbPool) {
      throw new Error("Database logging not enabled");
    }

    let query = "SELECT * FROM llm_logs WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (options.provider) {
      query += ` AND provider = $${paramIndex++}`;
      params.push(options.provider);
    }

    if (options.model) {
      query += ` AND model = $${paramIndex++}`;
      params.push(options.model);
    }

    if (options.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(options.startDate.toISOString());
    }

    if (options.endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(options.endDate.toISOString());
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(options.limit || 100);

    const result = await this.dbPool.query(query, params);

    return result.rows.map((row) => ({
      timestamp: row.timestamp,
      provider: row.provider,
      model: row.model,
      messages: row.messages,
      response: row.response,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      latencyMs: row.latency_ms,
      cost: row.cost ? parseFloat(row.cost) : undefined,
      error: row.error,
      metadata: row.metadata,
    }));
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(options: {
    provider?: string;
    model?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
    byModel: Record<string, {
      calls: number;
      tokens: number;
      cost: number;
    }>;
  }> {
    if (!this.dbPool) {
      throw new Error("Database logging not enabled");
    }

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (options.provider) {
      whereClause += ` AND provider = $${paramIndex++}`;
      params.push(options.provider);
    }

    if (options.model) {
      whereClause += ` AND model = $${paramIndex++}`;
      params.push(options.model);
    }

    if (options.startDate) {
      whereClause += ` AND timestamp >= $${paramIndex++}`;
      params.push(options.startDate.toISOString());
    }

    if (options.endDate) {
      whereClause += ` AND timestamp <= $${paramIndex++}`;
      params.push(options.endDate.toISOString());
    }

    // Overall stats
    const overallQuery = `
      SELECT
        COUNT(*) as total_calls,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        AVG(latency_ms) as avg_latency
      FROM llm_logs
      ${whereClause}
    `;

    const overallResult = await this.dbPool.query(overallQuery, params);
    const overall = overallResult.rows[0];

    // By model stats
    const byModelQuery = `
      SELECT
        model,
        COUNT(*) as calls,
        SUM(total_tokens) as tokens,
        SUM(cost) as cost
      FROM llm_logs
      ${whereClause}
      GROUP BY model
    `;

    const byModelResult = await this.dbPool.query(byModelQuery, params);
    const byModel: Record<string, any> = {};

    for (const row of byModelResult.rows) {
      byModel[row.model] = {
        calls: parseInt(row.calls),
        tokens: parseInt(row.tokens) || 0,
        cost: parseFloat(row.cost) || 0,
      };
    }

    return {
      totalCalls: parseInt(overall.total_calls) || 0,
      totalTokens: parseInt(overall.total_tokens) || 0,
      totalCost: parseFloat(overall.total_cost) || 0,
      averageLatency: parseFloat(overall.avg_latency) || 0,
      byModel,
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.dbPool) {
      await this.dbPool.end();
    }
  }
}

// Cost estimation helper
function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const costs: Record<string, Record<string, { input: number; output: number }>> = {
    anthropic: {
      "claude-opus-4-20250514": { input: 15, output: 75 },
      "claude-sonnet-4-20250514": { input: 3, output: 15 },
      "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
      "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
    },
    openai: {
      "gpt-4o": { input: 2.5, output: 10 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      o1: { input: 15, output: 60 },
      "o1-mini": { input: 3, output: 12 },
    },
    mistral: {
      "mistral-large-latest": { input: 2, output: 6 },
      "mistral-small-latest": { input: 0.2, output: 0.6 },
    },
    google: {
      "gemini-2.0-flash-exp": { input: 0, output: 0 },
      "gemini-1.5-pro": { input: 1.25, output: 5 },
      "gemini-1.5-flash": { input: 0.075, output: 0.3 },
    },
  };

  const providerCosts = costs[provider];
  if (!providerCosts) return 0;

  const modelCosts = providerCosts[model];
  if (!modelCosts) return 0;

  const inputCost = (inputTokens / 1_000_000) * modelCosts.input;
  const outputCost = (outputTokens / 1_000_000) * modelCosts.output;

  return inputCost + outputCost;
}

/**
 * Convenience function to log a manual LLM call
 */
export async function logLLMCall(
  provider: string,
  model: string,
  messages: any[],
  response: any,
  metadata?: Record<string, any>
): Promise<void> {
  const logger = LLMLogger.getInstance();

  const entry: LLMLogEntry = {
    timestamp: new Date().toISOString(),
    provider,
    model,
    messages,
    response: response?.content || response,
    inputTokens: response?.usage_metadata?.input_tokens || 0,
    outputTokens: response?.usage_metadata?.output_tokens || 0,
    totalTokens:
      (response?.usage_metadata?.input_tokens || 0) +
      (response?.usage_metadata?.output_tokens || 0),
    latencyMs: 0,
    cost: estimateCost(
      provider,
      model,
      response?.usage_metadata?.input_tokens || 0,
      response?.usage_metadata?.output_tokens || 0
    ),
    metadata,
  };

  await logger.log(entry);
}
