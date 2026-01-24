use anyhow::Result;
use std::path::Path;

use crate::templates::embedded;
use crate::utils::fs::write_file;

/// Scaffold AI agents framework
pub async fn scaffold(project_path: &str) -> Result<()> {
    let project = Path::new(project_path);

    // Create AI directory structure at src/components/ai/core
    let ai_path = project.join("src/components/ai/core");
    tokio::fs::create_dir_all(&ai_path).await?;

    // Copy embedded AI templates
    embedded::copy_embedded_dir("ai/core", &ai_path).await?;

    // Create AI index file
    write_file(project_path, "src/components/ai/index.ts", AI_INDEX)?;

    // Create Claude skill file
    let claude_dir = project.join(".claude/skills");
    tokio::fs::create_dir_all(&claude_dir).await?;
    write_file(project_path, ".claude/skills/ai.md", CLAUDE_AI_SKILL)?;

    // Create example agent file
    tokio::fs::create_dir_all(project.join("src/components/ai/agents")).await?;
    write_file(project_path, "src/components/ai/agents/example.ts", EXAMPLE_AGENT)?;

    Ok(())
}

// ============================================================================
// Embedded Templates
// ============================================================================

const AI_INDEX: &str = r#"// AI Framework - Re-exports from core modules
export * from "@/components/ai/core/providers";
export * from "@/components/ai/core/logging";
export * from "@/components/ai/core/chunking";
export * from "@/components/ai/core/embedding";
"#;

const CLAUDE_AI_SKILL: &str = r#"# AI Agents Skill

This project includes a LangChain-based AI agents framework.

## Available Modules

### Providers (`src/components/ai/core/providers`)
- Unified interface for Anthropic, OpenAI, Google, Mistral, Ollama
- Model registry with cost estimation
- Fallback chains for reliability

### Logging (`src/components/ai/core/logging`)
- LLM call logging to terminal, database, or file
- Token counting and cost tracking
- Usage statistics

### Chunking (`src/components/ai/core/chunking`)
- Text chunking strategies: character, token, semantic, recursive, markdown
- Presets for different use cases

### Embedding (`src/components/ai/core/embedding`)
- Multi-provider embedding generation
- Batch processing and semantic search

## Usage

```typescript
import { createLLM, LLMLogger, TextChunker, EmbeddingGenerator } from "@/components/ai";

// Create LLM instance
const llm = createLLM({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  temperature: 0.7,
});

// Log calls
LLMLogger.getInstance().initialize({
  destinations: ["terminal"]
});

// Chunk text
const chunker = new TextChunker({ strategy: "semantic" });
const chunks = await chunker.chunk(longText);

// Generate embeddings
const embedder = new EmbeddingGenerator("openai");
const embeddings = await embedder.embed(texts);
```

## Environment Variables

Required for AI features:
- `ANTHROPIC_API_KEY` - For Claude models
- `OPENAI_API_KEY` - For GPT models and embeddings
"#;

const EXAMPLE_AGENT: &str = r#"import { createLLM, ModelRegistry } from "@/components/ai/core/providers";
import { LLMLogger } from "@/components/ai/core/logging";

// Initialize logging (optional)
if (process.env.LLMLOG) {
  const logger = LLMLogger.getInstance();
}

// Create LLM with Claude
const llm = createLLM({
  provider: "anthropic",
  model: ModelRegistry.anthropic.sonnet,
  temperature: 0.7,
});

export async function runAgent(input: string): Promise<string> {
  const response = await llm.invoke([
    {
      role: "system",
      content: "You are a helpful assistant.",
    },
    {
      role: "user",
      content: input,
    },
  ]);

  return response.content as string;
}
"#;
