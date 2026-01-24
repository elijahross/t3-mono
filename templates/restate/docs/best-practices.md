# Restate Agentic Workflows - Best Practices

This guide distills best practices from production implementations of Restate workflows with LangChain agents.

## Table of Contents

1. [Workflow Design](#workflow-design)
2. [Service Architecture](#service-architecture)
3. [Error Handling & Retries](#error-handling--retries)
4. [LangChain Agent Integration](#langchain-agent-integration)
5. [Performance Optimization](#performance-optimization)
6. [Testing Strategies](#testing-strategies)
7. [Deployment & Operations](#deployment--operations)

---

## Workflow Design

### Choose the Right Service Type

**Use `restate.workflow()` when:**
- Process has multiple steps that should execute exactly once
- You need to track workflow progress by unique ID
- Failure recovery should resume from last successful step
- Examples: Document processing pipeline, multi-agent collaboration

**Use `restate.service()` when:**
- Operation is stateless and can be retried safely
- No need to track execution by ID
- Used as utility/helper service
- Examples: Embedding generation, image analysis, S3 operations

**Use `restate.object()` when:**
- State is tied to a specific entity (key-based routing)
- Need single-threaded execution per entity
- Managing resources or sessions
- Examples: User chat sessions, file processing queues

### Idempotency is Critical

```typescript
// ✅ GOOD: Unique workflow IDs ensure idempotent execution
const workflowId = `process-${tenderId}-${timestamp}`;
await ctx.serviceClient(FileExtractionService).run(workflowId, input);

// ❌ BAD: Random IDs defeat idempotency
const workflowId = crypto.randomUUID(); // Will create duplicates on retry!
```

### Determinism in Workflows

```typescript
// ✅ GOOD: Non-deterministic operations wrapped in ctx.run()
const timestamp = await ctx.run("getTimestamp", () => Date.now());
const random = await ctx.run("getRandom", () => Math.random());

// ❌ BAD: Direct non-deterministic operations break replay
const timestamp = Date.now(); // Will differ on replay!
const random = Math.random(); // Will differ on replay!
```

### State Management

```typescript
// ✅ GOOD: Store state in database via ctx.run()
const state = await ctx.run("loadState", async () => {
  return await db.query("SELECT * FROM workflow_state WHERE id = $1", [id]);
});

// Update state durably
await ctx.run("updateState", async () => {
  return await db.query("UPDATE workflow_state SET status = $1", ["completed"]);
});

// ❌ BAD: Local variables lost on restart
let localState = {}; // Lost on crash/restart!
```

---

## Service Architecture

### Service Composition Pattern

Build complex workflows by composing simple services:

```typescript
// Main workflow orchestrates multiple services
const workflow = restate.workflow({
  name: "DocumentProcessingWorkflow",
  handlers: {
    run: async (ctx: WorkflowContext, input: ProcessInput) => {
      // Step 1: Download from S3
      const file = await ctx.serviceClient(AWSS3Service)
        .downloadFileToBuffer({ key: input.s3Key });

      // Step 2: Extract content
      const extracted = await ctx.serviceClient(ExtractionService)
        .extractDocument({ content: file, format: "markdown" });

      // Step 3: Generate embeddings
      const embeddings = await ctx.serviceClient(EmbeddingService)
        .generateEmbeddings({ texts: [extracted.content] });

      // Step 4: Store results
      await ctx.run("storeResults", async () => {
        await db.storeDocument(extracted, embeddings);
      });

      return { status: "success" };
    }
  }
});
```

### Single Responsibility Principle

Each service should have one clear purpose:

```typescript
// ✅ GOOD: Focused services
const EmbeddingService = restate.service({
  name: "EmbeddingService",
  handlers: {
    generateEmbeddings: async (ctx, input) => { /* ... */ }
  }
});

// ❌ BAD: God service doing everything
const ProcessingService = restate.service({
  name: "ProcessingService",
  handlers: {
    extractAndEmbedAndStoreAndNotify: async (ctx, input) => {
      // Too many responsibilities!
    }
  }
});
```

### Configuration Management

```typescript
// ✅ GOOD: Externalize configuration
interface ServiceConfig {
  ollamaEndpoint: string;
  embeddingModel: string;
  maxRetries: number;
}

const config: ServiceConfig = {
  ollamaEndpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
  embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
  maxRetries: parseInt(process.env.MAX_RETRIES || "5")
};

// ❌ BAD: Hardcoded values
const ollamaEndpoint = "http://localhost:11434"; // Can't change per environment
```

---

## Error Handling & Retries

### Consistent Retry Configuration

Define retry policies once and reuse:

```typescript
// Shared retry configuration
export const retryConfig = {
  initialRetryInterval: { milliseconds: 1500 },
  retryIntervalFactor: 2,
  maxRetryInterval: { seconds: 1 },
  maxRetryAttempts: 5,
  maxRetryDuration: { seconds: 1 },
};

// Apply consistently
await ctx.run("operation", retryConfig, async () => {
  return await unreliableExternalAPI();
});
```

### Operation-Specific Retry Policies

Different operations may need different strategies:

```typescript
// Fast-fail for validation errors
const quickRetry = {
  initialRetryInterval: { milliseconds: 100 },
  maxRetryAttempts: 2
};

// Patient retry for embeddings
const patientRetry = {
  initialRetryInterval: { seconds: 2 },
  retryIntervalFactor: 2,
  maxRetryAttempts: 10,
  maxRetryDuration: { minutes: 5 }
};
```

### Error Classification

Distinguish between retryable and non-retryable errors:

```typescript
class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

await ctx.run("callAPI", retryConfig, async () => {
  try {
    return await externalAPI();
  } catch (error: any) {
    if (error.status === 429) {
      throw new RetryableError("Rate limited"); // Will retry
    } else if (error.status === 400) {
      throw new PermanentError("Bad request"); // Won't retry
    }
    throw error;
  }
});
```

### Circuit Breaker Pattern

Prevent cascading failures:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private threshold = 5;
  private timeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailure < this.timeout) {
        throw new Error("Circuit breaker open");
      }
      this.failures = 0; // Reset after timeout
    }

    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      throw error;
    }
  }
}
```

---

## LangChain Agent Integration

### Agent Hierarchy Pattern

Use inheritance for shared functionality:

```typescript
// Base agent with common features
abstract class BaseAgent {
  protected model: BaseChatModel;
  protected tools: any[];
  protected memory?: InMemoryStore;

  abstract run(input: string): Promise<any>;

  protected async storeInMemory(key: string, value: any) {
    if (this.memory) {
      await this.memory.mset([[key, value]]);
    }
  }
}

// Specialized agents extend base
class DocumentAnalyzerAgent extends BaseAgent {
  async run(input: string) {
    // Implementation
  }
}
```

### Middleware Chain Pattern

Handle cross-cutting concerns with middleware:

```typescript
// Error handling middleware
const handleToolErrors = async (
  { messages, ...state }: any,
  config: any,
  next: any
) => {
  try {
    return await next({ messages, ...state }, config);
  } catch (error: any) {
    const errorMessage = new ToolMessage({
      content: `Error: ${error.message}`,
      tool_call_id: state.messages[state.messages.length - 1].id
    });
    return next({ ...state, messages: [...messages, errorMessage] }, config);
  }
};

// Summarization middleware
const summarizeMiddleware = async (
  { messages, ...state }: any,
  config: any,
  next: any
) => {
  if (messages.length > 50) {
    // Summarize old messages
    const summary = await summarizeMessages(messages.slice(0, -10));
    messages = [summary, ...messages.slice(-10)];
  }
  return next({ messages, ...state }, config);
};

// Apply middleware chain
middleware: [handleToolErrors, summarizeMiddleware]
```

### Tool Development Best Practices

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ✅ GOOD: Well-defined tool
export const searchDocumentsTool = tool(
  async (input, config) => {
    // Validate input (Zod does this automatically)
    // Execute operation
    const results = await hybridSearch(input.query, input.filters);

    // Return structured data
    return JSON.stringify(results);
  },
  {
    name: "search_documents",
    description: "Search documents using hybrid semantic + full-text search. " +
                 "Use this when you need to find relevant information in the document corpus.",
    schema: z.object({
      query: z.string().describe("The search query"),
      filters: z.object({
        documentType: z.string().optional(),
        dateRange: z.object({
          start: z.string(),
          end: z.string()
        }).optional()
      }).optional()
    })
  }
);

// ❌ BAD: Vague tool
export const doStuffTool = tool(
  async (input) => {
    // What does this do?
    return "done";
  },
  {
    name: "do_stuff",
    description: "Does stuff", // Not helpful!
    schema: z.object({
      thing: z.any() // No validation!
    })
  }
);
```

### Prompt Engineering

Structure prompts for reliability:

```typescript
const systemPrompt = `
You are a document analysis assistant with access to a corpus of tender and offer documents.

## Role
- Analyze documents to answer user questions
- Provide citations for all claims using the format [[[DOCUMENT_ID: 123]]]
- Use available tools to search and retrieve information

## Available Tools
You have access to:
1. search_documents - Hybrid search across all documents
2. get_document_by_id - Retrieve specific document by ID
3. analyze_image - Analyze images within documents

## Response Format
- Answer questions directly and concisely
- Always cite sources using [[[DOCUMENT_ID: X]]]
- If information is not found, say so explicitly
- Do not make up information

## Example
User: What is the budget for project X?
Assistant: The budget for project X is €500,000 [[[DOCUMENT_ID: 42]]].
`;
```

### Agent Memory Management

```typescript
// Token-aware memory
class TokenLimitedMemory {
  private maxTokens = 4000;
  private messages: any[] = [];

  async addMessage(message: any) {
    this.messages.push(message);

    // Summarize if over limit
    const tokenCount = await this.countTokens(this.messages);
    if (tokenCount > this.maxTokens) {
      await this.summarizeOldMessages();
    }
  }

  private async summarizeOldMessages() {
    const keepCount = 10;
    const toSummarize = this.messages.slice(0, -keepCount);
    const summary = await this.createSummary(toSummarize);

    this.messages = [
      new SystemMessage(summary),
      ...this.messages.slice(-keepCount)
    ];
  }
}
```

---

## Performance Optimization

### Parallel Execution

Use `RestatePromise.all()` for independent operations:

```typescript
// ✅ GOOD: Parallel execution (3x faster)
const [images, documents, criteria] = await RestatePromise.all([
  ctx.serviceClient(ImageService).analyze(imageIds),
  ctx.serviceClient(DocumentService).fetch(docIds),
  ctx.serviceClient(CriteriaService).evaluate(criteriaIds)
]);

// ❌ BAD: Sequential execution (slow)
const images = await ctx.serviceClient(ImageService).analyze(imageIds);
const documents = await ctx.serviceClient(DocumentService).fetch(docIds);
const criteria = await ctx.serviceClient(CriteriaService).evaluate(criteriaIds);
```

### Batching

Process items in batches to balance throughput and latency:

```typescript
const BATCH_SIZE = 10;

async function processBatch(ctx: WorkflowContext, items: any[]) {
  const batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    await RestatePromise.all(
      batch.map(item =>
        ctx.serviceClient(ProcessingService).process(item)
      )
    );
  }
}
```

### Caching Strategy

Cache expensive operations:

```typescript
// In-memory cache with TTL
class Cache<T> {
  private store = new Map<string, { value: T; expires: number }>();

  set(key: string, value: T, ttlMs: number) {
    this.store.set(key, {
      value,
      expires: Date.now() + ttlMs
    });
  }

  get(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expires) {
      this.store.delete(key);
      return undefined;
    }
    return item.value;
  }
}

// Use in service
const embeddingCache = new Cache<number[]>();

async function getEmbedding(ctx: Context, text: string) {
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const embedding = await ctx.run("generateEmbedding", async () => {
    return await ollamaEmbed(text);
  });

  embeddingCache.set(text, embedding, 3600000); // 1 hour
  return embedding;
}
```

### Database Connection Pooling

```typescript
// ✅ GOOD: Singleton pool
let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// ❌ BAD: New connection per call
export function getDbConnection(): Pool {
  return new Pool({ /* config */ }); // Leaks connections!
}
```

---

## Testing Strategies

### Unit Testing Services

```typescript
import { describe, it, expect, beforeEach } from "@jest/globals";
import { TestDriver } from "@restatedev/restate-sdk-testcontainers";

describe("EmbeddingService", () => {
  let testDriver: TestDriver;

  beforeEach(async () => {
    testDriver = await TestDriver.start(embeddingService);
  });

  it("should generate embeddings", async () => {
    const result = await testDriver.client
      .serviceClient(EmbeddingService)
      .generateEmbeddings({
        texts: ["test document"],
        model: "nomic-embed-text"
      });

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toHaveLength(768);
  });
});
```

### Integration Testing Workflows

```typescript
describe("DocumentProcessingWorkflow", () => {
  it("should process document end-to-end", async () => {
    const workflowId = "test-workflow-1";

    const result = await testDriver.client
      .workflowClient(DocumentProcessingWorkflow)
      .run(workflowId, {
        s3Key: "test-documents/sample.pdf"
      });

    expect(result.status).toBe("success");

    // Verify side effects
    const document = await db.getDocument(workflowId);
    expect(document).toBeDefined();
    expect(document.embeddings).toBeDefined();
  });
});
```

### Mocking External Dependencies

```typescript
import { vi } from "vitest";

// Mock Ollama API
const mockOllamaEmbed = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);

// Mock S3 client
const mockS3 = {
  getObject: vi.fn().mockResolvedValue({
    Body: Buffer.from("test content")
  })
};
```

---

## Deployment & Operations

### Docker Compose Setup

```yaml
version: '3.8'

services:
  restate:
    image: restatedev/restate:latest
    ports:
      - "8080:8080"
      - "9070:9070"
      - "9071:9071"
    environment:
      - RESTATE_OBSERVABILITY__LOG_LEVEL=info

  workflow-service:
    build: ./flows/my-workflow
    ports:
      - "9081:9081"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
      - OLLAMA_ENDPOINT=http://ollama:11434
    depends_on:
      - restate
      - db

  db:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Health Checks

```typescript
// Add health check endpoint
const service = restate.service({
  name: "MyService",
  handlers: {
    health: async (ctx: Context) => {
      // Check dependencies
      const dbHealthy = await checkDatabase();
      const ollamaHealthy = await checkOllama();

      return {
        status: dbHealthy && ollamaHealthy ? "healthy" : "unhealthy",
        checks: { database: dbHealthy, ollama: ollamaHealthy }
      };
    }
  }
});
```

### Monitoring & Observability

```typescript
// Structured logging
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label })
  }
});

// Log in workflows
await ctx.run("operation", async () => {
  logger.info({ workflowId, step: "extraction" }, "Starting extraction");
  const result = await extract();
  logger.info({ workflowId, step: "extraction", duration: result.duration }, "Extraction complete");
  return result;
});
```

### Graceful Shutdown

```typescript
const server = restate.createServer().bind(myService);

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");

  // Stop accepting new requests
  await server.close();

  // Close database connections
  await pool.end();

  process.exit(0);
});
```

---

## Summary Checklist

### Workflow Design
- [ ] Use correct service type (workflow vs service vs object)
- [ ] Ensure idempotent workflow IDs
- [ ] Wrap non-deterministic operations in `ctx.run()`
- [ ] Store state in durable storage, not local variables

### Service Architecture
- [ ] Single responsibility per service
- [ ] Compose services for complex workflows
- [ ] Externalize configuration
- [ ] Use connection pooling

### Error Handling
- [ ] Define consistent retry policies
- [ ] Classify errors (retryable vs permanent)
- [ ] Implement circuit breakers for external dependencies
- [ ] Handle tool errors gracefully in agents

### Agent Integration
- [ ] Use agent hierarchy for code reuse
- [ ] Apply middleware for cross-cutting concerns
- [ ] Define tools with Zod schemas
- [ ] Structure prompts clearly
- [ ] Manage token limits in memory

### Performance
- [ ] Use parallel execution for independent operations
- [ ] Batch large datasets
- [ ] Cache expensive operations
- [ ] Pool database connections

### Testing
- [ ] Unit test individual services
- [ ] Integration test workflows end-to-end
- [ ] Mock external dependencies
- [ ] Test retry and failure scenarios

### Operations
- [ ] Use Docker Compose for local development
- [ ] Implement health checks
- [ ] Add structured logging
- [ ] Handle graceful shutdown
- [ ] Monitor Restate UI (port 9070)

---

## Additional Resources

- [Restate TypeScript SDK Documentation](https://docs.restate.dev/develop/ts/)
- [LangChain Documentation](https://js.langchain.com/)
- [Pattern: Saga Pattern](https://docs.restate.dev/develop/ts/patterns/saga)
- [Pattern: Service Communication](https://docs.restate.dev/develop/ts/service-communication)
