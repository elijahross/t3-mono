# t3-mono

A CLI tool to scaffold T3 stack apps with Better Auth pre-configured, and optional AI/UI/Restate extensions.

## Quick Start

```bash
# Create a new project
npx t3-mono my-app

# With AI agents (LangChain)
npx t3-mono my-app --ai

# With UI components
npx t3-mono my-app --ui

# With Restate durable workflows
npx t3-mono my-app --restate

# With all extensions
npx t3-mono my-app --ai --ui --restate
```

## Features

### Base Stack (always included)
- **Next.js 15** with App Router and Turbopack
- **TypeScript** with strict mode
- **Tailwind CSS v4** with PostCSS
- **tRPC** for type-safe APIs
- **Prisma** for database ORM
- **Better Auth** for authentication

### AI Extension (`--ai`)
- **LangChain** with multiple providers (Anthropic, OpenAI, Google, Mistral, Ollama)
- **LLM Logging** to terminal, database, or file
- **Text Chunking** with 5 strategies
- **Embeddings** with multi-provider support
- **Claude Code Skill** for AI-assisted development

### UI Extension (`--ui`)
- **38+ components** (buttons, dialogs, forms, tables, etc.)
- **Dark mode** support via CSS variables
- **Accessible** components built on Radix primitives
- **Customizable** with Tailwind

### Restate Extension (`--restate`)
- **Durable Workflows** with automatic retry and fault tolerance
- **Pre-built Services**: Embeddings (Ollama), Document Extraction (Docling), AWS S3, AWS Lambda
- **Docker Compose** setup for local development
- **Production Ready** patterns and best practices

## Add to Existing Project

```bash
# Add AI to existing project
npx t3-mono add ai

# Add UI to existing project
npx t3-mono add ui

# Add Restate to existing project
npx t3-mono add restate
```

## CLI Options

```
Usage: t3-mono [OPTIONS] [NAME] [COMMAND]

Arguments:
  [NAME]  Name of the project to create [default: .]

Commands:
  add   Add an extension to an existing project

Options:
  -a, --ai           Include LangChain AI agents framework
  -u, --ui           Include UI component library
  -r, --restate      Include Restate durable workflow services
  -i, --interactive  Run in interactive mode with prompts
      --no-git       Skip git initialization
  -h, --help         Print help
  -V, --version      Print version
```

## Project Structure

```
my-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/   # tRPC endpoint
│   │   │   └── auth/[...all]/ # Better Auth endpoint
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── server/
│   │   ├── api/               # tRPC routers
│   │   ├── auth.ts            # Better Auth config
│   │   └── db.ts              # Prisma client
│   ├── components/ui/         # (with --ui)
│   ├── ai/                    # (with --ai)
│   │   ├── core/              # Providers, logging, chunking, embedding
│   │   └── agents/            # Custom agents
│   └── lib/
├── restate/                   # (with --restate)
│   ├── services/              # Durable workflow services
│   ├── examples/              # Example workflows
│   ├── docker-compose.yml     # Infrastructure setup
│   └── docs/                  # Best practices
├── .claude/skills/ai.md       # (with --ai) Claude Code skill
├── prisma/schema.prisma       # Database schema with auth models
├── package.json
└── ...config files
```

## Development

### Building from source

```bash
cd t3-mono
cargo build --release
```

### Running locally

```bash
./target/release/t3-mono my-app --ai --ui --restate
```

## License

MIT
