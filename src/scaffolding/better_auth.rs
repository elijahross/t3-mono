use anyhow::Result;
use crate::utils::fs::write_file;

/// Scaffold Better Auth integration
pub async fn scaffold(project_path: &str) -> Result<()> {
    // Write auth configuration
    write_file(project_path, "src/server/auth.ts", AUTH_CONFIG)?;

    // Write auth API route
    write_file(project_path, "src/app/api/auth/[...all]/route.ts", AUTH_ROUTE)?;

    // Write auth client
    write_file(project_path, "src/lib/auth-client.ts", AUTH_CLIENT)?;

    // Append Better Auth models to Prisma schema
    append_to_prisma_schema(project_path)?;

    Ok(())
}

fn append_to_prisma_schema(project_path: &str) -> Result<()> {
    let schema_path = std::path::Path::new(project_path).join("prisma/schema.prisma");
    let mut content = std::fs::read_to_string(&schema_path)?;
    content.push_str(PRISMA_AUTH_MODELS);
    std::fs::write(schema_path, content)?;
    Ok(())
}

// ============================================================================
// Embedded Templates
// ============================================================================

const AUTH_CONFIG: &str = r#"import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/server/db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

export type Session = typeof auth.$Infer.Session;
"#;

const AUTH_ROUTE: &str = r#"import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
"#;

const AUTH_CLIENT: &str = r#"import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
"#;

const PRISMA_AUTH_MODELS: &str = r#"
// ============================================================================
// Better Auth Models
// ============================================================================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions Session[]
  accounts Account[]
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id                    String  @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([providerId, accountId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([identifier, value])
}
"#;
