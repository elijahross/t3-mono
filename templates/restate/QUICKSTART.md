# Restate Quick Start Guide

Get started with Restate agentic workflows in 5 minutes.

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- curl or Postman (for testing)

## Step 1: Start Infrastructure

```bash
cd restate

# Copy environment template
cp .env.example .env

# Edit .env with your AWS credentials (if using S3/Lambda)
nano .env

# Start all services
docker-compose up -d

# Wait for services to be healthy
docker-compose ps
```

This starts:
- Restate orchestrator (ports 8080, 9070)
- Ollama (port 11434)
- Docling (port 5000)
- PostgreSQL (port 5432)
- Restate Services (port 9082)

## Step 2: Pull Embedding Model

```bash
# Pull Ollama embedding model
docker exec ollama ollama pull nomic-embed-text

# Verify
docker exec ollama ollama list
```

## Step 3: Register Services

```bash
# Register reusable services
curl -X POST http://localhost:9070/deployments \
  -H 'content-type: application/json' \
  -d '{"uri": "http://services:9082"}'

# Verify registration
curl http://localhost:9070/deployments
```

You should see:
- EmbeddingService
- ExtractionService
- AWSS3Service
- AWSLambdaService

## Step 4: Test Services

### Test Embedding Service

```bash
curl -X POST http://localhost:8080/EmbeddingService/generateEmbedding \
  -H 'content-type: application/json' \
  -d '{
    "text": "Hello, Restate!",
    "model": "nomic-embed-text"
  }'
```

Expected: JSON with `embedding` array (768 dimensions)

### Test Extraction Service

```bash
curl -X POST http://localhost:8080/ExtractionService/health
```

Expected: `{"status": "healthy"}`

### Test S3 Service

```bash
curl -X POST http://localhost:8080/AWSS3Service/listFiles \
  -H 'content-type: application/json' \
  -d '{
    "prefix": "",
    "maxKeys": 10
  }'
```

Expected: List of files (if AWS credentials configured)

## Step 5: Run Example Workflow

### Deploy Simple Workflow

```bash
cd examples/simple-workflow
npm install
npm run build
npm start &

# Register with Restate
curl -X POST http://localhost:9070/deployments \
  -H 'content-type: application/json' \
  -d '{"uri": "http://localhost:9084"}'
```

### Invoke Workflow

```bash
curl -X POST http://localhost:8080/SimpleWorkflow/run \
  -H 'content-type: application/json' \
  -d '{
    "workflowId": "greeting-1",
    "name": "Alice",
    "language": "en"
  }'
```

Expected: `{"result": "Hello, Alice! (2024-01-24T...)\"}`

### Try Idempotency

```bash
# Invoke again with same workflowId - returns cached result instantly
curl -X POST http://localhost:8080/SimpleWorkflow/run \
  -H 'content-type: application/json' \
  -d '{
    "workflowId": "greeting-1",
    "name": "Alice",
    "language": "en"
  }'
```

## Step 6: View in Restate UI

Open http://localhost:9070 in your browser.

You'll see:
- Registered services and workflows
- Execution history
- Individual step results
- Retry attempts
- Performance metrics

## Step 7: Build Your First Workflow

```bash
# Create new workflow
mkdir my-workflow
cd my-workflow
npm init -y
npm install @restatedev/restate-sdk
npm install -D typescript tsx @types/node

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist"
  }
}
EOF

# Create workflow
cat > src/index.ts << 'EOF'
import * as restate from "@restatedev/restate-sdk";
import { WorkflowContext } from "@restatedev/restate-sdk";
import { EmbeddingService } from "@restate/services";

export const MyWorkflow = restate.workflow({
  name: "MyWorkflow",
  handlers: {
    run: async (ctx: WorkflowContext, input: { text: string }) => {
      // Generate embedding
      const result = await ctx.serviceClient(EmbeddingService)
        .generateEmbedding({ text: input.text });

      return { embedding: result.embedding };
    }
  }
});

const port = 9087;
restate.endpoint().bind(MyWorkflow).listen(port);
EOF

# Build and run
npm run build
npm start &

# Register
curl -X POST http://localhost:9070/deployments \
  -H 'content-type: application/json' \
  -d '{"uri": "http://localhost:9087"}'

# Invoke
curl -X POST http://localhost:8080/MyWorkflow/run \
  -H 'content-type: application/json' \
  -d '{"text": "My first workflow!"}'
```

## Next Steps

### 1. Explore Examples

```bash
cd restate/examples
```

- **simple-workflow** - Basic patterns
- **multi-step-workflow** - Sequential processing
- **parallel-processing** - Concurrent operations

### 2. Use Reusable Services

Import and use in your workflows:

```typescript
import {
  EmbeddingService,
  ExtractionService,
  AWSS3Service,
  AWSLambdaService
} from "@restate/services";
```

### 3. Read Best Practices

```bash
cat restate/docs/best-practices.md
```

### 4. Use the Restate Skill

In Claude Code:

```bash
/restatedev help
```

The skill provides guidance on:
- Building durable workflows
- LangChain agent integration
- Service composition patterns
- Error handling and retries

## Common Commands

### View Logs

```bash
# Restate orchestrator
docker logs -f restate_dev

# Services
docker logs -f restate_services

# Ollama
docker logs -f ollama

# Docling
docker logs -f docling
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart services
```

### Stop All

```bash
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Health Checks

```bash
# Restate
curl http://localhost:9070/health

# Services
curl http://localhost:8080/EmbeddingService/health
curl http://localhost:8080/ExtractionService/health
curl http://localhost:8080/AWSS3Service/health
curl http://localhost:8080/AWSLambdaService/health

# Ollama
curl http://localhost:11434/api/version

# Docling
curl http://localhost:5000/health
```

## Troubleshooting

### Services Won't Register

```bash
# Check services are running
docker ps

# Check service health
docker-compose ps

# View logs
docker logs restate_services
```

### Embedding Errors

```bash
# Ensure model is pulled
docker exec ollama ollama pull nomic-embed-text

# Check Ollama is running
curl http://localhost:11434/api/version
```

### Extraction Errors

```bash
# Check Docling is running
curl http://localhost:5000/health

# Restart if needed
docker-compose restart docling
```

### Port Conflicts

```bash
# Check what's using ports
lsof -i :8080
lsof -i :9070

# Stop conflicting services or change ports in docker-compose.yml
```

## Resources

- **Documentation**: `restate/README.md`
- **Best Practices**: `restate/docs/best-practices.md`
- **Service README**: `restate/services/README.md`
- **Examples**: `restate/examples/`
- **Restate Docs**: https://docs.restate.dev/
- **Restate UI**: http://localhost:9070

## Support

- Restate Discord: https://discord.gg/skW3AZ6uGd
- GitHub Issues: https://github.com/restatedev/restate
- Documentation: https://docs.restate.dev/

Happy building with Restate! 🚀
