use anyhow::Result;
use std::path::Path;
use crate::cli::AuthProvider;
use crate::templates::embedded;
use crate::utils::fs::write_file;

/// Scaffold the T3 stack base project
pub async fn scaffold(project_path: &str) -> Result<()> {
    let project = Path::new(project_path);

    // Write configuration files
    write_file(project_path, "tsconfig.json", TSCONFIG)?;
    write_file(project_path, "next.config.js", NEXT_CONFIG)?;
    write_file(project_path, "tailwind.config.ts", TAILWIND_CONFIG)?;
    write_file(project_path, "postcss.config.js", POSTCSS_CONFIG)?;
    write_file(project_path, "biome.jsonc", BIOME_CONFIG)?;
    // Note: .env.example is written in finalize_package_json based on auth provider

    // Write source files
    write_file(project_path, "src/app/layout.tsx", APP_LAYOUT)?;
    write_file(project_path, "src/app/page.tsx", APP_PAGE)?;
    write_file(project_path, "src/styles/globals.css", GLOBALS_CSS)?;

    // Write ThemeProvider component
    write_file(project_path, "src/app/_components/ThemeProvider.tsx", THEME_PROVIDER)?;

    // Write tRPC setup
    write_file(project_path, "src/server/api/trpc.ts", TRPC_INIT)?;
    write_file(project_path, "src/server/api/root.ts", TRPC_ROOT)?;
    write_file(project_path, "src/app/api/trpc/[trpc]/route.ts", TRPC_ROUTE)?;
    write_file(project_path, "src/lib/trpc.ts", TRPC_CLIENT)?;

    // Write Prisma schema and config
    write_file(project_path, "prisma/schema.prisma", PRISMA_SCHEMA)?;
    write_file(project_path, "prisma.config.ts", PRISMA_CONFIG)?;

    // Write database client
    write_file(project_path, "src/server/db.ts", DB_CLIENT)?;

    // Write utility functions
    write_file(project_path, "src/lib/utils.ts", UTILS)?;

    // Write i18n setup
    write_file(project_path, "src/i18n/request.ts", I18N_REQUEST)?;
    write_file(project_path, "src/types/dictionary.ts", DICTIONARY_TYPES)?;
    write_file(project_path, "messages/en.json", MESSAGES_EN)?;
    write_file(project_path, "messages/de.json", MESSAGES_DE)?;

    // Copy Docker templates
    let docker_dest = project.join("");
    embedded::copy_embedded_dir("docker", &docker_dest).await?;

    // Copy documentation templates
    let docs_dest = project.join("docs");
    tokio::fs::create_dir_all(&docs_dest).await?;
    embedded::copy_embedded_dir("docs", &docs_dest).await?;

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
            "lint": "biome lint .",
            "format": "biome format --write .",
            "check": "biome check --write .",
            "db:push": "prisma db push",
            "db:studio": "prisma studio",
            "db:generate": "prisma generate",
            "db:migrate": "prisma migrate dev",
            "test": "vitest"
        },
        "dependencies": {
            "next": "^16.1.4",
            "react": "^19.2.3",
            "react-dom": "^19.2.3",
            "@prisma/client": "^7.3.0",
            "@prisma/adapter-pg": "^7.3.0",
            "@trpc/client": "^11.8.1",
            "@trpc/server": "^11.8.1",
            "@trpc/react-query": "^11.8.1",
            "@tanstack/react-query": "^5.90.20",
            "@t3-oss/env-nextjs": "^0.13.10",
            "next-themes": "^0.4.6",
            "next-intl": "^4.7.0",
            "superjson": "^2.2.1",
            "zod": "^4.3.6",
            "server-only": "^0.0.1",
            "lucide-react": "^0.563.0",
            "clsx": "^2.1.1",
            "tailwind-merge": "^3.4.0"
        },
        "devDependencies": {
            "typescript": "^5.9.3",
            "@types/node": "^25.0.10",
            "@types/react": "^19.2.9",
            "@types/react-dom": "^19.2.3",
            "prisma": "^7.3.0",
            "tailwindcss": "^4.1.18",
            "@tailwindcss/postcss": "^4.1.18",
            "postcss": "^8.5.3",
            "dotenv": "^16.5.0",
            "@biomejs/biome": "^1.9.0",
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

const NEXT_CONFIG: &str = r#"/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import("next").NextConfig} */
const config = {};

export default withNextIntl(config);
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

const APP_LAYOUT: &str = r#"import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "./_components/ThemeProvider";

export const metadata: Metadata = {
  title: "My App",
  description: "Built with t3-mono",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
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

@theme {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif,
    "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}

:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.5rem;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
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

const THEME_PROVIDER: &str = r#""use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
"#;

const PRISMA_CONFIG: &str = r#"import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
"#;

const I18N_REQUEST: &str = r#"import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

type Messages = Record<string, string>;

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const locale = (await cookieStore).get("locale")?.value ?? "en";

  const messages = (await import(`../../messages/${locale}.json`)) as {
    default: Messages;
  };

  return {
    locale,
    messages: messages.default,
  };
});
"#;

const DICTIONARY_TYPES: &str = r#"import type de from "../../messages/de.json";
import type en from "../../messages/en.json";

export const locales = ["de", "en"] as const;

export type AppDictionary = typeof de;
"#;

const MESSAGES_EN: &str = r#"{}
"#;

const MESSAGES_DE: &str = r#"{}
"#;

const BIOME_CONFIG: &str = r#"{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "root": true,
  "vcs": {
    "enabled": true,
    "useIgnoreFile": true,
    "clientKind": "git"
  },
  "assist": {
    "enabled": true,
    "actions": {
      "recommended": true,
      "source": {
        "recommended": true,
        "organizeImports": "on",
        "useSortedAttributes": "on"
      }
    }
  },
  "formatter": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "nursery": {
        "useSortedClasses": {
          "level": "warn",
          "fix": "safe",
          "options": {
            "functions": ["clsx", "cva", "cn"]
          }
        }
      }
    }
  },
  "html": {
    "formatter": {
      "enabled": true
    }
  },
  "javascript": {
    "assist": {
      "enabled": true
    },
    "formatter": {
      "enabled": true
    },
    "linter": {
      "enabled": true
    }
  },
  "css": {
    "assist": {
      "enabled": true
    },
    "formatter": {
      "enabled": true
    },
    "linter": {
      "enabled": true
    },
    "parser": {
      "cssModules": true,
      "tailwindDirectives": true
    }
  }
}
"#;
