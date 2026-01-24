use anyhow::Result;
use std::path::Path;

use crate::templates::embedded;
use crate::utils::fs::write_file;

/// Scaffold Restate durable workflow services
pub async fn scaffold(project_path: &str) -> Result<()> {
    let project = Path::new(project_path);

    // Create restate directory structure
    let restate_path = project.join("restate");
    tokio::fs::create_dir_all(&restate_path).await?;

    // Copy embedded Restate templates
    embedded::copy_embedded_dir("restate/", &restate_path).await?;

    // Create restate index/readme for the project
    write_file(project_path, "restate/README.md", RESTATE_README)?;

    Ok(())
}

// ============================================================================
// Embedded Templates
// ============================================================================

const RESTATE_README: &str = r#"# Restate Durable Workflows

This project includes Restate for building durable, fault-tolerant workflows.

## Quick Start

```bash
# Start infrastructure (Restate, Ollama, Docling, PostgreSQL)
docker-compose up -d

# Install dependencies
cd services && npm install

# Start services
npm run dev

# Register with Restate
curl -X POST http://localhost:9070/deployments \
  -H 'content-type: application/json' \
  -d '{"uri": "http://host.docker.internal:9082"}'
```

## Available Services

### Embedding Service (port 9082)
Generate text embeddings using Ollama:
```bash
curl -X POST http://localhost:8080/EmbeddingService/embed \
  -H 'content-type: application/json' \
  -d '{"text": "Hello, world!"}'
```

### Extraction Service (port 9082)
Extract content from documents (PDF, DOCX, PPTX):
```bash
curl -X POST http://localhost:8080/ExtractionService/extract \
  -H 'content-type: application/json' \
  -d '{"url": "https://example.com/document.pdf", "outputFormat": "markdown"}'
```

### AWS S3 Service (port 9082)
S3 operations with durable execution:
```bash
curl -X POST http://localhost:8080/S3Service/upload \
  -H 'content-type: application/json' \
  -d '{"bucket": "my-bucket", "key": "file.txt", "content": "..."}'
```

### AWS Lambda Service (port 9082)
Invoke Lambda functions durably:
```bash
curl -X POST http://localhost:8080/LambdaService/invoke \
  -H 'content-type: application/json' \
  -d '{"functionName": "my-function", "payload": {}}'
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Restate   │────▶│  Services   │
│             │     │  (8080)     │     │  (9082)     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌─────────┐   ┌─────────┐
              │ Ollama  │   │ Docling │
              │(11434)  │   │ (5000)  │
              └─────────┘   └─────────┘
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Restate
PORT=9082

# Ollama
OLLAMA_ENDPOINT=http://localhost:11434

# Docling
DOCLING_ENDPOINT=http://localhost:5000

# AWS (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
```

## Documentation

- [Best Practices](docs/best-practices.md) - Production patterns and guidelines
- [Restate Docs](https://docs.restate.dev/) - Official Restate documentation
"#;
