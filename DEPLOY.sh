#!/bin/bash

# ============================================
# Wis Legal - Deploy Script
# ============================================
# Este script automatiza o processo de deploy
# para produção usando Netlify CLI
# ============================================

set -e  # Exit on error

echo "🚀 Wis Legal - Deploy to Production"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}❌ Netlify CLI not found${NC}"
    echo ""
    echo "Install it with:"
    echo "  npm install -g netlify-cli"
    echo ""
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "Make sure environment variables are configured in Netlify dashboard"
    echo ""
fi

# 1. Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/
echo -e "${GREEN}✓ Clean complete${NC}"
echo ""

# 2. Install dependencies (if needed)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# 3. Build project
echo "🔨 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# 4. Check build output
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ dist/ directory not found${NC}"
    exit 1
fi

BUILD_SIZE=$(du -sh dist/ | cut -f1)
echo "📊 Build size: $BUILD_SIZE"
echo ""

# 5. Deploy to Netlify
echo "🚀 Deploying to Netlify..."
echo ""

read -p "Deploy to production? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    netlify deploy --prod --dir=dist

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Deploy successful!${NC}"
        echo ""
        echo "🎉 Your app is now live!"
        echo ""
        echo "Next steps:"
        echo "1. Test the production site"
        echo "2. Monitor error logs"
        echo "3. Check mobile experience"
        echo "4. Verify JSON sanitization is working"
        echo ""
    else
        echo ""
        echo -e "${RED}❌ Deploy failed${NC}"
        exit 1
    fi
else
    echo ""
    echo "Deploy cancelled. To deploy later, run:"
    echo "  netlify deploy --prod --dir=dist"
    echo ""
fi

echo "Done! 🎉"
