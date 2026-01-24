# Project Documentation

This project was generated with [t3-mono](https://github.com/your-repo/t3-mono), a CLI tool for scaffolding T3 Stack applications.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma](https://www.prisma.io/)
- **API**: [tRPC](https://trpc.io/) for type-safe APIs
- **Authentication**: [Better Auth](https://better-auth.com/) or NextAuth
- **Theming**: [next-themes](https://github.com/pacocoursey/next-themes)
- **i18n**: [next-intl](https://next-intl-docs.vercel.app/)
- **Linting**: [Biome](https://biomejs.dev/)

## Getting Started

### Prerequisites

- Node.js 18+
- Docker or Podman (for local database)
- pnpm, npm, or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Copy the environment example file:

```bash
cp .env.example .env
```

3. Start the local database:

```bash
./start-database.sh
```

4. Push the database schema:

```bash
npm run db:push
```

5. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
.
├── docs/                    # Documentation
├── messages/                # i18n translation files
├── prisma/                  # Prisma schema and migrations
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── _components/     # Page-specific components
│   │   └── api/             # API routes
│   ├── components/          # Shared components
│   │   └── ai/              # AI components (if enabled)
│   ├── i18n/                # Internationalization config
│   ├── lib/                 # Utility functions
│   ├── server/              # Server-side code
│   │   ├── api/             # tRPC routers
│   │   └── better-auth/     # Auth configuration
│   ├── styles/              # Global styles
│   └── types/               # TypeScript types
├── Dockerfile.database      # PostgreSQL with extensions
├── docker-compose.yml       # Docker compose configuration
├── start-database.sh        # Database startup script
└── package.json
```

## Available Scripts

| Script          | Description                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Start development server with Turbopack |
| `npm run build` | Build for production                     |
| `npm run start` | Start production server                  |
| `npm run lint`  | Run Biome linter                         |
| `npm run format`| Format code with Biome                   |
| `npm run check` | Run Biome check with auto-fix            |
| `npm run db:push` | Push Prisma schema to database         |
| `npm run db:studio` | Open Prisma Studio                   |
| `npm run db:generate` | Generate Prisma client             |
| `npm run db:migrate` | Run database migrations              |
| `npm run test`  | Run tests with Vitest                    |

## Documentation

- [Prisma Guide](./PRISMA.md) - Database setup and migrations
- [Theming Guide](./THEMING.md) - Dark/light mode configuration
- [i18n Guide](./I18N.md) - Internationalization setup

## Environment Variables

See `.env.example` for required environment variables.

## License

MIT
