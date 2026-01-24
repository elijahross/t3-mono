use anyhow::Result;
use crate::cli::AuthProvider;
use crate::utils::fs::write_file;

/// Scaffold the T3 stack base project
pub async fn scaffold(project_path: &str) -> Result<()> {
    // Write configuration files
    write_file(project_path, "tsconfig.json", TSCONFIG)?;
    write_file(project_path, "next.config.ts", NEXT_CONFIG)?;
    write_file(project_path, "tailwind.config.ts", TAILWIND_CONFIG)?;
    write_file(project_path, "postcss.config.js", POSTCSS_CONFIG)?;
    // Note: .env.example is written in finalize_package_json based on auth provider

    // Write source files
    write_file(project_path, "src/app/layout.tsx", APP_LAYOUT)?;
    write_file(project_path, "src/app/page.tsx", APP_PAGE)?;
    write_file(project_path, "src/app/globals.css", GLOBALS_CSS)?;

    // Write tRPC setup
    write_file(project_path, "src/server/api/trpc.ts", TRPC_INIT)?;
    write_file(project_path, "src/server/api/root.ts", TRPC_ROOT)?;
    write_file(project_path, "src/app/api/trpc/[trpc]/route.ts", TRPC_ROUTE)?;
    write_file(project_path, "src/lib/trpc.ts", TRPC_CLIENT)?;

    // Write Prisma schema
    write_file(project_path, "prisma/schema.prisma", PRISMA_SCHEMA)?;

    // Write database client
    write_file(project_path, "src/server/db.ts", DB_CLIENT)?;

    // Write utility functions
    write_file(project_path, "src/lib/utils.ts", UTILS)?;

    Ok(())
}

/// Finalize package.json with all dependencies
pub fn finalize_package_json(
    project_path: &str,
    include_ai: bool,
    include_ui: bool,
    auth_provider: AuthProvider,
) -> Result<()> {
    let mut pkg = serde_json::json!({
        "name": project_path.replace("/", "-").replace(".", "my-app"),
        "version": "0.1.0",
        "private": true,
        "type": "module",
        "scripts": {
            "dev": "next dev --turbopack",
            "build": "next build",
            "start": "next start",
            "lint": "next lint",
            "db:push": "prisma db push",
            "db:studio": "prisma studio",
            "db:generate": "prisma generate",
            "test": "vitest",
            "format": "prettier --write ."
        },
        "dependencies": {
            "next": "^16.1.1",
            "react": "^19.0.0",
            "react-dom": "^19.0.0",
            "@prisma/client": "^7.2.0",
            "@prisma/adapter-pg": "^7.2.0",
            "@trpc/client": "^11.0.0",
            "@trpc/server": "^11.0.0",
            "@trpc/react-query": "^11.0.0",
            "@tanstack/react-query": "^5.69.0",
            "@t3-oss/env-nextjs": "^0.13.10",
            "next-themes": "^0.4.6",
            "superjson": "^2.2.1",
            "zod": "^4.3.5",
            "server-only": "^0.0.1",
            "lucide-react": "^0.562.0"
        },
        "devDependencies": {
            "typescript": "^5.8.2",
            "@types/node": "^25.0.8",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "prisma": "^7.2.0",
            "tailwindcss": "^4.0.15",
            "@tailwindcss/postcss": "^4.0.15",
            "postcss": "^8.5.3",
            "eslint": "^9.23.0",
            "eslint-config-next": "^16.1.1",
            "@eslint/eslintrc": "^3.3.1",
            "typescript-eslint": "^8.27.0",
            "prettier": "^3.5.3",
            "prettier-plugin-tailwindcss": "^0.7.2",
            "vitest": "4.0.17",
            "@vitejs/plugin-react": "5.1.2",
            "@testing-library/react": "^16.3.0",
            "@testing-library/dom": "^10.4.0",
            "@testing-library/jest-dom": "^6.6.3",
            "jsdom": "27.4.0"
        }
    });

    // Add auth-specific dependencies
    let deps = pkg["dependencies"].as_object_mut().unwrap();
    match auth_provider {
        AuthProvider::BetterAuth => {
            deps.insert("better-auth".to_string(), serde_json::json!("^1.0.0"));
        }
        AuthProvider::NextAuth => {
            deps.insert("next-auth".to_string(), serde_json::json!("4.24.13"));
            deps.insert("@auth/prisma-adapter".to_string(), serde_json::json!("^2.7.2"));
        }
    }

    // Add AI dependencies if enabled
    if include_ai {
        let deps = pkg["dependencies"].as_object_mut().unwrap();
        deps.insert("@langchain/anthropic".to_string(), serde_json::json!("^0.3.11"));
        deps.insert("@langchain/core".to_string(), serde_json::json!("^0.3.28"));
        deps.insert("@langchain/openai".to_string(), serde_json::json!("^0.3.18"));
        deps.insert("langchain".to_string(), serde_json::json!("^0.3.7"));
        deps.insert("winston".to_string(), serde_json::json!("^3.17.0"));
        deps.insert("pg".to_string(), serde_json::json!("^8.13.1"));
    }

    // Add UI dependencies if enabled
    if include_ui {
        let deps = pkg["dependencies"].as_object_mut().unwrap();
        deps.insert("@floating-ui/react".to_string(), serde_json::json!("^0.27.16"));
        deps.insert("class-variance-authority".to_string(), serde_json::json!("^0.7.1"));
        deps.insert("clsx".to_string(), serde_json::json!("^2.1.1"));
        deps.insert("date-fns".to_string(), serde_json::json!("^4.1.0"));
        deps.insert("lucide-react".to_string(), serde_json::json!("^0.562.0"));
        deps.insert("react-day-picker".to_string(), serde_json::json!("^9.13.0"));
        deps.insert("recharts".to_string(), serde_json::json!("^2.15.4"));
        deps.insert("sonner".to_string(), serde_json::json!("^2.0.7"));
        deps.insert("tailwind-merge".to_string(), serde_json::json!("^3.4.0"));
        deps.insert("next-themes".to_string(), serde_json::json!("^0.4.6"));
    }

    let content = serde_json::to_string_pretty(&pkg)?;
    write_file(project_path, "package.json", &content)?;

    // Write .env.example with auth-specific variables
    let env_content = match auth_provider {
        AuthProvider::BetterAuth => ENV_EXAMPLE_BETTER_AUTH,
        AuthProvider::NextAuth => ENV_EXAMPLE_NEXT_AUTH,
    };
    write_file(project_path, ".env.example", env_content)?;

    Ok(())
}

// ============================================================================
// Embedded Templates
// ============================================================================

const TSCONFIG: &str = r#"{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
"#;

const NEXT_CONFIG: &str = r#"import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
"#;

const TAILWIND_CONFIG: &str = r#"import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
"#;

const POSTCSS_CONFIG: &str = r#"export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
"#;

const ENV_EXAMPLE_BETTER_AUTH: &str = r#"# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-min-32-chars-here"
BETTER_AUTH_URL="http://localhost:3000"

# AI (optional, if using --ai flag)
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
"#;

const ENV_EXAMPLE_NEXT_AUTH: &str = r#"# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-min-32-chars-here"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Providers (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# AI (optional, if using --ai flag)
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
"#;

const APP_LAYOUT: &str = r#"import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My App",
  description: "Built with create-monorepo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
"#;

const APP_PAGE: &str = r#"export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to your app</h1>
      <p className="mt-4 text-gray-600">
        Built with T3 Stack + Better Auth
      </p>
    </main>
  );
}
"#;

const GLOBALS_CSS: &str = r#"@import "tailwindcss";
"#;

const TRPC_INIT: &str = r#"import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/server/db";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
"#;

const TRPC_ROOT: &str = r#"import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  // Add your routers here
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
"#;

const TRPC_ROUTE: &str = r#"import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });

export { handler as GET, handler as POST };
"#;

const TRPC_CLIENT: &str = r#"import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/api/root";
import superjson from "superjson";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
    }),
  ],
});
"#;

const PRISMA_SCHEMA: &str = r#"generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
"#;

const DB_CLIENT: &str = r#"import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
"#;

const UTILS: &str = r#"import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
"#;
