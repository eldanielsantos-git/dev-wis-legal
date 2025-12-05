#!/bin/bash

# Tier System Deployment Verification Script
# Verifica se todos os componentes do tier system foram deployados corretamente

set -e

echo "🔍 TIER SYSTEM DEPLOYMENT VERIFICATION"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Check function
check() {
    local name="$1"
    local command="$2"

    echo -n "Checking $name... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

warn() {
    local message="$1"
    echo -e "${YELLOW}⚠ WARNING: $message${NC}"
    ((WARNINGS++))
}

info() {
    local message="$1"
    echo -e "${GREEN}ℹ INFO: $message${NC}"
}

echo "📦 Step 1: Database Tables"
echo "-------------------------"

# Check if tables exist
check "processing_tier_config table" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/rest/v1/rpc/check_table_exists\" \
    -H \"apikey: $VITE_SUPABASE_ANON_KEY\" \
    -H \"Content-Type: application/json\" \
    -d '{\"table_name\":\"processing_tier_config\"}' | grep -q true"

check "feature_flags table" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/rest/v1/rpc/check_table_exists\" \
    -H \"apikey: $VITE_SUPABASE_ANON_KEY\" \
    -H \"Content-Type: application/json\" \
    -d '{\"table_name\":\"feature_flags\"}' | grep -q true"

check "tier_usage_stats table" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/rest/v1/rpc/check_table_exists\" \
    -H \"apikey: $VITE_SUPABASE_ANON_KEY\" \
    -H \"Content-Type: application/json\" \
    -d '{\"table_name\":\"tier_usage_stats\"}' | grep -q true"

echo ""
echo "🔧 Step 2: Edge Functions"
echo "------------------------"

# Check edge functions
check "start-analysis-unified function" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/functions/v1/start-analysis-unified\" \
    -H \"Authorization: Bearer $VITE_SUPABASE_ANON_KEY\" | grep -qv 'Function not found'"

check "tier-aware-worker function" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/functions/v1/tier-aware-worker\" \
    -H \"Authorization: Bearer $VITE_SUPABASE_ANON_KEY\" | grep -qv 'Function not found'"

check "tier-aware-chunking function" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/functions/v1/tier-aware-chunking\" \
    -H \"Authorization: Bearer $VITE_SUPABASE_ANON_KEY\" | grep -qv 'Function not found'"

check "unified-recovery-coordinator function" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/functions/v1/unified-recovery-coordinator\" \
    -H \"Authorization: Bearer $VITE_SUPABASE_ANON_KEY\" | grep -qv 'Function not found'"

check "tier-analytics function" \
    "curl -s -X POST \"$VITE_SUPABASE_URL/functions/v1/tier-analytics\" \
    -H \"Authorization: Bearer $VITE_SUPABASE_ANON_KEY\" | grep -qv 'Function not found'"

echo ""
echo "⚙️  Step 3: Feature Flags Status"
echo "-------------------------------"

# Check if feature flags are properly set (should be OFF initially)
TIER_SYSTEM_STATUS=$(curl -s -X GET \
    "$VITE_SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.tier_system_enabled&select=is_enabled" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" | grep -o 'false')

if [ "$TIER_SYSTEM_STATUS" = "false" ]; then
    info "Tier system is DISABLED (safe for initial deploy)"
else
    warn "Tier system is ENABLED - ensure this is intentional!"
fi

echo ""
echo "📊 Step 4: Tier Configurations"
echo "-----------------------------"

# Count tier configs
TIER_COUNT=$(curl -s -X GET \
    "$VITE_SUPABASE_URL/rest/v1/processing_tier_config?select=count" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: count=exact" | grep -o '[0-9]*' | head -1)

if [ "$TIER_COUNT" -ge 5 ]; then
    info "Found $TIER_COUNT tier configurations"
    ((PASSED++))
else
    warn "Only found $TIER_COUNT tier configurations (expected 5+)"
fi

echo ""
echo "🔐 Step 5: RLS Policies"
echo "---------------------"

# This is informational - actual check would require service role
info "RLS policies should be verified manually with service role access"
warn "Ensure RLS policies are active for: feature_flags, processing_tier_config, tier_usage_stats"

echo ""
echo "🌐 Step 6: Frontend Build"
echo "-----------------------"

# Check if dist folder exists
if [ -d "dist" ]; then
    info "Production build exists in dist/"
    ((PASSED++))
else
    warn "Production build not found - run 'npm run build'"
fi

# Check if TierSystemService exists
if [ -f "src/services/TierSystemService.ts" ]; then
    info "TierSystemService.ts found"
    ((PASSED++))
else
    echo -e "${RED}✗ TierSystemService.ts NOT FOUND${NC}"
    ((FAILED++))
fi

echo ""
echo "======================================"
echo "📋 VERIFICATION SUMMARY"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ DEPLOYMENT VERIFICATION PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Deploy to production with all flags OFF"
    echo "2. Run smoke tests"
    echo "3. Enable flags gradually using rollout scripts"
    exit 0
else
    echo -e "${RED}❌ DEPLOYMENT VERIFICATION FAILED${NC}"
    echo ""
    echo "Fix the failed checks before deploying to production"
    exit 1
fi
