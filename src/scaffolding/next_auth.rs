use anyhow::Result;
use crate::utils::fs::write_file;

/// Scaffold NextAuth (v4) integration
pub async fn scaffold(project_path: &str) -> Result<()> {
    // Write auth configuration
    write_file(project_path, "src/server/auth.ts", AUTH_CONFIG)?;

    // Write auth API route
    write_file(project_path, "src/app/api/auth/[...nextauth]/route.ts", AUTH_ROUTE)?;

    // Write auth client
    write_file(project_path, "src/lib/auth-client.ts", AUTH_CLIENT)?;

    // Write session provider wrapper
    write_file(project_path, "src/components/providers/session-provider.tsx", SESSION_PROVIDER)?;

    // Append NextAuth models to Prisma schema
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

const AUTH_CONFIG: &str = r#"import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/server/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Add your own logic here to validate credentials
        // This is just a placeholder - implement proper validation
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        // TODO: Add password verification with bcrypt
        // const isValid = await bcrypt.compare(credentials.password, user.password);
        // if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
    jwt: ({ token, user }) => {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
"#;

const AUTH_ROUTE: &str = r#"import NextAuth from "next-auth";
import { authOptions } from "@/server/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
"#;

const AUTH_CLIENT: &str = r#"import { useSession, signIn, signOut } from "next-auth/react";

export { useSession, signIn, signOut };

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    user: session?.user,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    signIn,
    signOut,
  };
}
"#;

const SESSION_PROVIDER: &str = r#"\"use client\";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
"#;

const PRISMA_AUTH_MODELS: &str = r#"
// ============================================================================
// NextAuth Models
// ============================================================================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}
"#;
