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
check_version "next" "15.1.0"
check_version "react" "19.0.0"
check_version "typescript" "5.7.2"
check_version "tailwindcss" "4.0.0"

echo ""
echo "🗄️  Database & Auth"
check_version "@prisma/client" "6.1.0"
check_version "better-auth" "1.1.10"

echo ""
echo "🔌 tRPC"
check_version "@trpc/server" "11.0.0-rc.682"
check_version "@tanstack/react-query" "5.62.8"

echo ""
echo "🤖 AI Extension"
check_version "@langchain/core" "0.3.28"
check_version "@langchain/anthropic" "0.3.11"
check_version "@langchain/openai" "0.3.18"
check_version "langchain" "0.3.7"

echo ""
echo "🎨 UI Extension"
check_version "lucide-react" "0.562.0"
check_version "recharts" "2.15.4"
check_version "sonner" "2.0.7"

echo ""
echo "⚡ Restate Extension"
check_version "@restatedev/restate-sdk" "1.9.1"
check_version "@aws-sdk/client-s3" "3.712.0"

echo ""
echo "✅ Done! Update src/scaffolding/t3.rs for any changes."
