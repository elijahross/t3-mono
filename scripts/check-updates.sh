#!/bin/bash
# Check for dependency updates in t3-mono templates

set -e

echo "🔍 Checking template dependency versions..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_version() {
    local pkg=$1
    local current=$2
    local latest=$(npm view "$pkg" version 2>/dev/null || echo "error")

    if [ "$latest" = "error" ]; then
        echo -e "  $pkg: ${YELLOW}failed to fetch${NC}"
    elif [ "$current" = "$latest" ]; then
        echo -e "  $pkg: ${GREEN}$current (up to date)${NC}"
    else
        echo -e "  $pkg: $current → ${YELLOW}$latest available${NC}"
    fi
}

echo "📦 Core Stack"
check_version "next" "16.1.6"
check_version "react" "19.2.4"
check_version "react-dom" "19.2.4"
check_version "typescript" "5.9.3"
check_version "tailwindcss" "4.2.0"
check_version "@swc/helpers" "0.5.18"

echo ""
echo "🗄️  Database & Auth"
check_version "@prisma/client" "7.4.0"
check_version "@prisma/adapter-pg" "7.4.0"
check_version "prisma" "7.4.0"
check_version "better-auth" "1.4.18"
check_version "next-auth" "4.24.13"
check_version "@auth/prisma-adapter" "2.7.2"

echo ""
echo "🔌 tRPC"
check_version "@trpc/server" "11.10.0"
check_version "@trpc/client" "11.10.0"
check_version "@trpc/react-query" "11.10.0"
check_version "@tanstack/react-query" "5.90.21"
check_version "@t3-oss/env-nextjs" "0.13.10"
check_version "superjson" "2.2.6"

echo ""
echo "🧪 Testing"
check_version "vitest" "4.0.18"
check_version "@testing-library/react" "16.3.2"
check_version "@testing-library/dom" "10.4.1"
check_version "@testing-library/jest-dom" "6.9.1"
check_version "jsdom" "28.1.0"
check_version "@vitejs/plugin-react" "5.1.4"

echo ""
echo "🤖 AI Extension"
check_version "@langchain/anthropic" "1.3.18"
check_version "@langchain/core" "1.1.26"
check_version "@langchain/openai" "1.2.8"
check_version "langchain" "1.2.25"
check_version "winston" "3.19.0"
check_version "pg" "8.18.0"

echo ""
echo "🏝️  CommandIsland Extension"
check_version "@langchain/cohere" "1.0.2"
check_version "@langchain/google-genai" "2.1.19"
check_version "@langchain/mistralai" "1.0.4"
check_version "@langchain/ollama" "1.2.3"
check_version "@langchain/textsplitters" "1.0.1"
check_version "react-markdown" "10.1.0"
check_version "remark-gfm" "4.0.1"
check_version "pdfmake" "0.3.4"
check_version "exceljs" "4.4.0"
check_version "pptxgenjs" "4.0.1"
check_version "@aws-sdk/client-s3" "3.993.0"
check_version "@aws-sdk/s3-request-presigner" "3.993.0"

echo ""
echo "🎨 UI Extension"
check_version "lucide-react" "0.574.0"
check_version "@floating-ui/react" "0.27.18"
check_version "recharts" "2.15.4"
check_version "sonner" "2.0.7"
check_version "class-variance-authority" "0.7.1"
check_version "date-fns" "4.1.0"
check_version "react-day-picker" "9.13.2"
check_version "tailwind-merge" "3.4.1"

echo ""
echo "🔧 Dev Tools"
check_version "@biomejs/biome" "2.4.2"
check_version "dotenv" "17.3.1"
check_version "postcss" "8.5.6"
check_version "zod" "4.3.6"
check_version "next-intl" "4.8.3"
check_version "next-themes" "0.4.6"

echo ""
echo "⚡ Restate Extension"
check_version "@restatedev/restate-sdk" "1.9.1"

echo ""
echo "✅ Done! Update src/scaffolding/t3.rs for any changes."
