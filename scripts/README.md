# Tier System Deployment Scripts

This directory contains the deployment and rollout scripts for the tier-aware processing system.

## 📋 Scripts Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `verify-tier-deployment.sh` | Pre-deployment verification | Before deploying to production |
| `gradual-rollout.sh` | Progressive feature enablement | During rollout phases |
| `emergency-rollback.sh` | Instant system disable | If critical issues occur |

---

## 🔍 verify-tier-deployment.sh

### Purpose
Validates that all tier system components are properly deployed and configured before enabling features.

### Usage

```bash
cd scripts
./verify-tier-deployment.sh
```

### Prerequisites

Set these environment variables:
```bash
export VITE_SUPABASE_URL="your-supabase-url"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"  # Optional for RLS checks
```

### What It Checks

- ✅ Database tables exist (tier_config, feature_flags, tier_stats)
- ✅ Edge functions deployed (start-analysis-unified, etc.)
- ✅ Feature flags status (should be OFF initially)
- ✅ Tier configurations present (5 tiers)
- ✅ RLS policies (informational)
- ✅ Frontend build exists

### Exit Codes

- `0` = All checks passed, ready to deploy
- `1` = One or more checks failed, fix before proceeding

### Example Output

```
🔍 TIER SYSTEM DEPLOYMENT VERIFICATION
======================================

📦 Step 1: Database Tables
-------------------------
✓ processing_tier_config table
✓ feature_flags table
✓ tier_usage_stats table

🔧 Step 2: Edge Functions
------------------------
✓ start-analysis-unified function
✓ tier-aware-worker function
✓ tier-aware-chunking function

...

======================================
📋 VERIFICATION SUMMARY
======================================
Passed: 15
Failed: 0
Warnings: 2

✅ DEPLOYMENT VERIFICATION PASSED
```

---

## 🚀 gradual-rollout.sh

### Purpose
Enables tier system features progressively with health checks and manual confirmation gates.

### Usage

```bash
cd scripts
./gradual-rollout.sh
```

Then select a stage:
```
Select rollout stage:
1) Stage 0: Pre-flight checks
2) Stage 1: Enable SMALL tier only (5%)
3) Stage 2: Enable SMALL + MEDIUM (25%)
4) Stage 3: Enable SMALL + MEDIUM + LARGE (50%)
5) Stage 4: Enable all except MASSIVE (75%)
6) Stage 5: Enable ALL tiers (100%)
7) Check current status
```

### Prerequisites

Same environment variables as verification script:
```bash
export VITE_SUPABASE_URL="your-supabase-url"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
```

### Rollout Stages

**Stage 0: Pre-flight Checks**
- Validates system health
- No flags enabled
- Use before starting rollout

**Stage 1: SMALL Tier (5% rollout)**
- Enables: `tier_system_enabled`, `tier_small_enabled`
- Documents: < 100 pages
- Monitoring: 60 seconds + confirm

**Stage 2: MEDIUM Tier (25% rollout)**
- Enables: `tier_medium_enabled`
- Documents: 100-500 pages
- Monitoring: 120 seconds + confirm

**Stage 3: LARGE Tier (50% rollout)**
- Enables: `tier_large_enabled`
- Documents: 500-2000 pages
- Monitoring: 180 seconds + confirm

**Stage 4: XLARGE Tier (75% rollout)**
- Enables: `tier_xlarge_enabled`
- Documents: 2000-5000 pages
- Monitoring: 240 seconds + confirm

**Stage 5: MASSIVE Tier (100% rollout)**
- Enables: `tier_massive_enabled`
- Documents: 5000+ pages
- Monitoring: 300 seconds + confirm

### Safety Features

- ✅ Health check before each stage
- ✅ Health check after each stage
- ✅ Manual confirmation required
- ✅ Automatic rollback on health failure
- ✅ Current status display

### Example Session

```bash
$ ./gradual-rollout.sh

======================================
🚀 TIER SYSTEM GRADUAL ROLLOUT
======================================

Select rollout stage:
1) Stage 0: Pre-flight checks
...

Enter stage (0-7): 1

🎯 Stage 1: Enable SMALL Tier (5% rollout)
======================================

🏥 Running Health Check...
✓ System is healthy

Enabling: Master tier system
✓ Enabled: tier_system_enabled

Enabling: Small tier (< 100 pages)
✓ Enabled: tier_small_enabled

⏳ Monitor small tier performance
Waiting 60 seconds for monitoring...

Continue with next stage? (y/n) y

🏥 Running Health Check...
✓ System is healthy

✓ Stage 1 completed successfully
```

---

## 🚨 emergency-rollback.sh

### Purpose
Instantly disables ALL tier system features in case of critical issues.

### Usage

```bash
cd scripts
./emergency-rollback.sh
```

### Warning

⚠️ **This will IMMEDIATELY disable the entire tier system!**

Type `YES` to confirm (all caps).

### What It Does

1. Disables `tier_system_enabled` (master flag)
2. Disables all individual tier flags
3. Verifies all flags are disabled
4. Reports status

System automatically falls back to legacy processing mode.

### Prerequisites

Same environment variables:
```bash
export VITE_SUPABASE_URL="your-supabase-url"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
```

### When to Use

Execute emergency rollback if:
- ❌ Success rate drops below 80%
- ❌ Multiple critical errors
- ❌ Database performance degraded
- ❌ User complaints spike
- ❌ Cost exceeds budget significantly
- ❌ Data integrity issues

### Example Session

```bash
$ ./emergency-rollback.sh

======================================
🚨 EMERGENCY ROLLBACK
======================================

⚠️  WARNING: This will IMMEDIATELY disable all tier features!

Are you ABSOLUTELY SURE? (type 'YES' to confirm): YES

🚨 Starting emergency rollback...

Disabling Master tier system... ✓ DISABLED
Disabling Small tier... ✓ DISABLED
Disabling Medium tier... ✓ DISABLED
Disabling Large tier... ✓ DISABLED
Disabling XLarge tier... ✓ DISABLED
Disabling Massive tier... ✓ DISABLED

======================================
✅ ROLLBACK COMPLETED SUCCESSFULLY
======================================

Verifying rollback...
tier_system_enabled: ✓ disabled
tier_small_enabled: ✓ disabled
tier_medium_enabled: ✓ disabled
tier_large_enabled: ✓ disabled
tier_xlarge_enabled: ✓ disabled
tier_massive_enabled: ✓ disabled

✅ Verification passed: All flags disabled
```

### Post-Rollback Actions

1. System now uses legacy processing
2. No data loss
3. Investigate root cause
4. Fix issues
5. Test in staging
6. Plan re-rollout

---

## 🔧 Environment Setup

### Local/Development

```bash
# Copy from .env file
export VITE_SUPABASE_URL="your-dev-url"
export VITE_SUPABASE_ANON_KEY="your-dev-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-dev-service-key"
```

### Production

```bash
# Use production credentials (NEVER commit these!)
export VITE_SUPABASE_URL="https://prod-xxx.supabase.co"
export VITE_SUPABASE_ANON_KEY="prod-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="prod-service-key"
```

### CI/CD Integration

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Verify Tier Deployment
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: |
    cd scripts
    ./verify-tier-deployment.sh
```

---

## 📊 Monitoring

After running scripts, monitor via:

1. **Health Check Endpoint**
   ```bash
   curl -X GET "$VITE_SUPABASE_URL/functions/v1/tier-system-health-check" \
     -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
   ```

2. **Admin Dashboard**
   - Visit: https://your-domain.com/admin-tier-monitoring
   - Real-time health status
   - Per-tier metrics

3. **Feature Flags Page**
   - Visit: https://your-domain.com/admin-feature-flags
   - Current flag status
   - Performance stats

---

## 🆘 Troubleshooting

### Script Won't Execute

```bash
# Make executable
chmod +x script-name.sh

# Check shebang
head -n 1 script-name.sh
# Should be: #!/bin/bash
```

### Environment Variables Not Set

```bash
# Check if set
echo $VITE_SUPABASE_URL

# Set temporarily
export VITE_SUPABASE_URL="your-url"

# Or source from file
source .env
```

### Permission Denied

```bash
# Check permissions
ls -l script-name.sh

# Should be: -rwxr-xr-x

# Fix permissions
chmod 755 script-name.sh
```

### Curl Command Not Found

```bash
# Install curl
# Ubuntu/Debian:
sudo apt-get install curl

# macOS:
brew install curl
```

### jq Command Not Found

```bash
# Install jq (JSON processor)
# Ubuntu/Debian:
sudo apt-get install jq

# macOS:
brew install jq
```

---

## 📚 Additional Resources

- [Tier System Overview](../TIER_SYSTEM_OVERVIEW.md)
- [Rollout Guide](../TIER_SYSTEM_ROLLOUT_GUIDE.md)
- [Phase 4 Summary](../PHASE_4_SUMMARY.md)
- [Complete Summary](../TIER_SYSTEM_COMPLETE_SUMMARY.md)

---

## 🔒 Security Notes

### DO NOT:
- ❌ Commit credentials to git
- ❌ Share service role keys
- ❌ Run scripts with untrusted env vars
- ❌ Execute in production without testing

### DO:
- ✅ Use environment variables
- ✅ Test in staging first
- ✅ Keep credentials secure
- ✅ Review script output
- ✅ Document changes

---

**Last Updated:** 2025-12-05
**Version:** 1.0.0
**Status:** Production Ready
