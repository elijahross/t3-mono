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

    // Write env validation
    write_file(project_path, "src/env.js", ENV_JS)?;

    // Write source files
    write_file(project_path, "src/app/layout.tsx", APP_LAYOUT)?;
    write_file(project_path, "src/app/page.tsx", APP_PAGE)?;
    write_file(project_path, "src/styles/globals.css", GLOBALS_CSS)?;

    // Write app components
    write_file(project_path, "src/app/_components/ThemeProvider.tsx", THEME_PROVIDER)?;
    write_file(project_path, "src/app/_components/Header.tsx", HEADER_COMPONENT)?;
    write_file(project_path, "src/app/_components/LanguageSwitcher.tsx", LANGUAGE_SWITCHER)?;

    // Write dashboard page
    write_file(project_path, "src/app/dashboard/page.tsx", DASHBOARD_PAGE)?;

    // Write tRPC server setup
    write_file(project_path, "src/server/api/trpc.ts", TRPC_INIT)?;
    write_file(project_path, "src/server/api/root.ts", TRPC_ROOT)?;
    write_file(project_path, "src/app/api/trpc/[trpc]/route.ts", TRPC_ROUTE)?;

    // Write tRPC client setup
    write_file(project_path, "src/trpc/react.tsx", TRPC_REACT)?;
    write_file(project_path, "src/trpc/query-client.ts", TRPC_QUERY_CLIENT)?;
    write_file(project_path, "src/trpc/server.ts", TRPC_SERVER)?;

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
        deps.insert("@langchain/anthropic".to_string(), serde_json::json!("^1.3.12"));
        deps.insert("@langchain/core".to_string(), serde_json::json!("^1.1.17"));
        deps.insert("@langchain/openai".to_string(), serde_json::json!("^1.2.3"));
        deps.insert("langchain".to_string(), serde_json::json!("^0.3.20"));
        deps.insert("winston".to_string(), serde_json::json!("^3.17.0"));
        deps.insert("pg".to_string(), serde_json::json!("^8.16.0"));
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
import { NextIntlClientProvider, useLocale } from "next-intl";
import { TRPCReactProvider } from "@/trpc/react";
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
  const locale = useLocale();
  return (
    <html lang={locale} className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <NextIntlClientProvider locale={locale}>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
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


const PRISMA_SCHEMA: &str = r#"generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
"#;

const DB_CLIENT: &str = r#"import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

function createPrismaClient() {
	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
	return new PrismaClient({
		adapter,
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

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

const MESSAGES_EN: &str = r#"{
  "nav": {
    "dashboard": "Dashboard",
    "settings": "Settings",
    "tagline": "Your App Tagline"
  },
  "language": {
    "switchLanguage": "Switch Language",
    "german": "German",
    "english": "English"
  }
}
"#;

const MESSAGES_DE: &str = r#"{
  "nav": {
    "dashboard": "Dashboard",
    "settings": "Einstellungen",
    "tagline": "Ihr App-Slogan"
  },
  "language": {
    "switchLanguage": "Sprache wechseln",
    "german": "Deutsch",
    "english": "Englisch"
  }
}
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

const ENV_JS: &str = r#"import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
"#;

const TRPC_REACT: &str = r#""use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "@/server/api/root";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient();

  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            return headers;
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
"#;

const TRPC_QUERY_CLIENT: &str = r#"import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
"#;

const TRPC_SERVER: &str = r#"import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { cache } from "react";

import { createCaller, type AppRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { createQueryClient } from "./query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient
);
"#;

const HEADER_COMPONENT: &str = r#""use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";

export interface NavItem {
  href: string;
  labelKey: string;
}

export interface HeaderProps {
  navItems?: NavItem[];
}

const defaultNavItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard" },
];

export function Header({ navItems = defaultNavItems }: HeaderProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Side - Logo */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-primary rounded flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-primary-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <span className="text-xl font-bold text-primary group-hover:text-primary/80 transition-colors">
                  My App
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {t("tagline")}
                </span>
              </div>
            </Link>
          </div>

          {/* Right Side - Language Switcher & Menu */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {/* Hamburger Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted cursor-pointer transition-colors"
                aria-label="Menu"
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card rounded-xl border border-border/50 shadow-lg py-2 z-50">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                          isActive
                            ? "text-primary bg-primary/5"
                            : "text-muted-foreground hover:text-primary hover:bg-muted"
                        }`}
                      >
                        {t(item.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
"#;

const LANGUAGE_SWITCHER: &str = r#""use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

type Locale = "de" | "en";

function setLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/locale=([^;]+)/);
  return (match?.[1] as Locale) ?? "en";
}

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const [isOpen, setIsOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>("en");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentLocale(getLocaleFromCookie());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocaleChange = (locale: Locale) => {
    setLocaleCookie(locale);
    setCurrentLocale(locale);
    setIsOpen(false);
    // Reload the page to apply the new locale
    window.location.reload();
  };

  const localeLabels: Record<Locale, string> = {
    de: t("german"),
    en: t("english"),
  };

  const localeFlags: Record<Locale, string> = {
    de: "DE",
    en: "EN",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary border border-border/50 rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
        aria-label={t("switchLanguage")}
      >
        <span className="font-semibold">{localeFlags[currentLocale]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-card border border-border/50 rounded-xl shadow-lg z-50">
          <ul className="py-1">
            {(["de", "en"] as const).map((locale) => (
              <li key={locale}>
                <button
                  onClick={() => handleLocaleChange(locale)}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted cursor-pointer ${
                    currentLocale === locale ? "text-primary font-medium" : "text-foreground"
                  }`}
                >
                  <span className="font-semibold text-muted-foreground">{localeFlags[locale]}</span>
                  {localeLabels[locale]}
                  {currentLocale === locale && (
                    <svg
                      className="w-4 h-4 ml-auto text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
"#;

const DASHBOARD_PAGE: &str = r#""use client";

import { Header } from "@/app/_components/Header";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your dashboard. Start building something amazing!
        </p>
      </main>
    </div>
  );
}
"#;
