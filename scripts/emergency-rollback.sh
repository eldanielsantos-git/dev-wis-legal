#!/bin/bash

# Emergency Rollback Script for Tier System
# Instantly disables all tier system features

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set${NC}"
    exit 1
fi

echo "======================================"
echo "🚨 EMERGENCY ROLLBACK"
echo "======================================"
echo ""
echo -e "${RED}⚠️  WARNING: This will IMMEDIATELY disable all tier system features!${NC}"
echo ""
echo "This will:"
echo "  - Disable master tier system flag"
echo "  - Disable all individual tier flags"
echo "  - System will fall back to legacy processing"
echo ""

read -p "Are you ABSOLUTELY SURE you want to proceed? (type 'YES' to confirm): " confirm

if [ "$confirm" != "YES" ]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${RED}🚨 Starting emergency rollback...${NC}"
echo ""

# Disable all flags
FLAGS=(
    "tier_system_enabled:Master tier system"
    "tier_small_enabled:Small tier"
    "tier_medium_enabled:Medium tier"
    "tier_large_enabled:Large tier"
    "tier_xlarge_enabled:XLarge tier"
    "tier_massive_enabled:Massive tier"
)

FAILED=0
SUCCEEDED=0

for flag_entry in "${FLAGS[@]}"; do
    IFS=':' read -r flag_key description <<< "$flag_entry"

    echo -n "Disabling $description... "

    response=$(curl -s -w "\n%{http_code}" -X PATCH \
        "$SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.$flag_key" \
        -H "apikey: $SUPABASE_SERVICE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"is_enabled\": false}")

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
        echo -e "${GREEN}✓ DISABLED${NC}"
        ((SUCCEEDED++))
    else
        echo -e "${RED}✗ FAILED (HTTP $http_code)${NC}"
        ((FAILED++))
    fi
done

echo ""
echo "======================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ROLLBACK COMPLETED SUCCESSFULLY${NC}"
    echo ""
    echo "All tier system features have been disabled."
    echo "System is now using legacy processing mode."
else
    echo -e "${YELLOW}⚠️  ROLLBACK PARTIALLY COMPLETED${NC}"
    echo ""
    echo -e "${GREEN}Succeeded: $SUCCEEDED${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo "Some flags may still be enabled. Manual intervention required."
fi

echo "======================================"
echo ""

# Verify rollback
echo "Verifying rollback..."
echo ""

response=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/feature_flags?select=flag_key,is_enabled&flag_key=in.(tier_system_enabled,tier_small_enabled,tier_medium_enabled,tier_large_enabled,tier_xlarge_enabled,tier_massive_enabled)" \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json")

echo "$response" | jq -r '.[] | "\(.flag_key): \(if .is_enabled then "❌ STILL ENABLED" else "✓ disabled" end)"'

echo ""

# Check if any flags are still enabled
STILL_ENABLED=$(echo "$response" | jq '[.[] | select(.is_enabled == true)] | length')

if [ "$STILL_ENABLED" -eq 0 ]; then
    echo -e "${GREEN}✅ Verification passed: All tier flags are disabled${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Investigate the root cause of the issue"
    echo "2. Review logs and error reports"
    echo "3. Fix issues before attempting re-rollout"
    echo "4. Test thoroughly in staging"
    exit 0
else
    echo -e "${RED}❌ Verification failed: $STILL_ENABLED flags still enabled${NC}"
    echo ""
    echo "MANUAL ACTION REQUIRED:"
    echo "1. Check database connection"
    echo "2. Manually disable flags via Supabase dashboard"
    echo "3. Contact system administrator"
    exit 1
fi
