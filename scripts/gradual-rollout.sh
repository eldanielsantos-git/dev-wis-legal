#!/bin/bash

# Gradual Rollout Script for Tier System
# This script enables tier system features progressively

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

# Functions
enable_flag() {
    local flag_key="$1"
    local description="$2"

    echo -e "${BLUE}Enabling: $description${NC}"

    curl -s -X PATCH \
        "$SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.$flag_key" \
        -H "apikey: $SUPABASE_SERVICE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"is_enabled\": true}" > /dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Enabled: $flag_key${NC}"
    else
        echo -e "${RED}✗ Failed to enable: $flag_key${NC}"
        return 1
    fi
}

check_status() {
    echo -e "\n${BLUE}📊 Current Feature Flags Status:${NC}"

    curl -s -X GET \
        "$SUPABASE_URL/rest/v1/feature_flags?select=flag_key,is_enabled,description&order=flag_key" \
        -H "apikey: $SUPABASE_SERVICE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        -H "Content-Type: application/json" | \
        jq -r '.[] | "\(.flag_key): \(if .is_enabled then "✓ ENABLED" else "✗ DISABLED" end) - \(.description // "No description")"'

    echo ""
}

wait_and_confirm() {
    local message="$1"
    local wait_time="${2:-30}"

    echo -e "${YELLOW}⏳ $message${NC}"
    echo -e "${YELLOW}Waiting ${wait_time} seconds for monitoring...${NC}"

    sleep "$wait_time"

    read -p "Continue with next step? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Rollout cancelled by user${NC}"
        exit 1
    fi
}

run_health_check() {
    echo -e "\n${BLUE}🏥 Running Health Check...${NC}"

    response=$(curl -s -X GET \
        "$SUPABASE_URL/functions/v1/tier-system-health-check" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

    status=$(echo "$response" | jq -r '.status')

    if [ "$status" = "healthy" ]; then
        echo -e "${GREEN}✓ System is healthy${NC}"
        return 0
    elif [ "$status" = "degraded" ]; then
        echo -e "${YELLOW}⚠ System is degraded but operational${NC}"
        echo "$response" | jq -r '.checks | to_entries[] | select(.value.status != "healthy") | "\(.key): \(.value.message)"'
        return 0
    else
        echo -e "${RED}✗ System is unhealthy!${NC}"
        echo "$response" | jq '.'
        return 1
    fi
}

# Main rollout stages
main() {
    echo "======================================"
    echo "🚀 TIER SYSTEM GRADUAL ROLLOUT"
    echo "======================================"
    echo ""

    check_status

    # Ask user which stage to run
    echo "Select rollout stage:"
    echo "1) Stage 0: Pre-flight checks (recommended first)"
    echo "2) Stage 1: Enable SMALL tier only (5% rollout)"
    echo "3) Stage 2: Enable SMALL + MEDIUM (25% rollout)"
    echo "4) Stage 3: Enable SMALL + MEDIUM + LARGE (50% rollout)"
    echo "5) Stage 4: Enable all tiers except MASSIVE (75% rollout)"
    echo "6) Stage 5: Enable ALL tiers (100% rollout)"
    echo "7) Check current status"
    echo ""
    read -p "Enter stage (0-7): " stage

    case $stage in
        0)
            echo -e "\n${BLUE}🔍 Stage 0: Pre-flight Checks${NC}"
            echo "======================================"

            run_health_check || {
                echo -e "${RED}Health check failed. Fix issues before proceeding.${NC}"
                exit 1
            }

            echo -e "\n${GREEN}✓ Pre-flight checks passed${NC}"
            echo "Ready for Stage 1 rollout"
            ;;

        1)
            echo -e "\n${BLUE}🎯 Stage 1: Enable SMALL Tier (5% rollout)${NC}"
            echo "======================================"

            run_health_check || exit 1

            enable_flag "tier_system_enabled" "Master tier system toggle"
            enable_flag "tier_small_enabled" "Small tier (< 100 pages)"

            wait_and_confirm "Monitor small tier performance" 60

            run_health_check || {
                echo -e "${RED}Health check failed after Stage 1. Consider rollback.${NC}"
                exit 1
            }

            echo -e "\n${GREEN}✓ Stage 1 completed successfully${NC}"
            ;;

        2)
            echo -e "\n${BLUE}🎯 Stage 2: Enable MEDIUM Tier (25% rollout)${NC}"
            echo "======================================"

            run_health_check || exit 1

            enable_flag "tier_medium_enabled" "Medium tier (100-500 pages)"

            wait_and_confirm "Monitor medium tier performance" 120

            run_health_check || {
                echo -e "${RED}Health check failed after Stage 2. Consider rollback.${NC}"
                exit 1
            }

            echo -e "\n${GREEN}✓ Stage 2 completed successfully${NC}"
            ;;

        3)
            echo -e "\n${BLUE}🎯 Stage 3: Enable LARGE Tier (50% rollout)${NC}"
            echo "======================================"

            run_health_check || exit 1

            enable_flag "tier_large_enabled" "Large tier (500-2000 pages)"

            wait_and_confirm "Monitor large tier performance" 180

            run_health_check || {
                echo -e "${RED}Health check failed after Stage 3. Consider rollback.${NC}"
                exit 1
            }

            echo -e "\n${GREEN}✓ Stage 3 completed successfully${NC}"
            ;;

        4)
            echo -e "\n${BLUE}🎯 Stage 4: Enable XLARGE Tier (75% rollout)${NC}"
            echo "======================================"

            run_health_check || exit 1

            enable_flag "tier_xlarge_enabled" "XLarge tier (2000-5000 pages)"

            wait_and_confirm "Monitor xlarge tier performance" 240

            run_health_check || {
                echo -e "${RED}Health check failed after Stage 4. Consider rollback.${NC}"
                exit 1
            }

            echo -e "\n${GREEN}✓ Stage 4 completed successfully${NC}"
            ;;

        5)
            echo -e "\n${BLUE}🎯 Stage 5: Enable MASSIVE Tier (100% rollout)${NC}"
            echo "======================================"

            run_health_check || exit 1

            enable_flag "tier_massive_enabled" "Massive tier (5000+ pages)"

            wait_and_confirm "Monitor massive tier performance" 300

            run_health_check || {
                echo -e "${RED}Health check failed after Stage 5. Consider rollback.${NC}"
                exit 1
            }

            echo -e "\n${GREEN}✓✓✓ FULL ROLLOUT COMPLETED ✓✓✓${NC}"
            echo -e "${GREEN}All tiers are now enabled!${NC}"
            ;;

        7)
            check_status
            ;;

        *)
            echo -e "${RED}Invalid stage selected${NC}"
            exit 1
            ;;
    esac

    echo ""
    echo "======================================"
    echo "📊 Rollout stage completed"
    echo "======================================"
    echo ""
    echo "Next steps:"
    echo "1. Monitor metrics at /admin-tier-monitoring"
    echo "2. Check logs for any errors"
    echo "3. Proceed to next stage when confident"
    echo ""
}

main "$@"
