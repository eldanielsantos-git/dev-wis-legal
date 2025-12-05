# Tier System Rollout Guide

## 📋 Overview

This guide provides a complete walkthrough for deploying and gradually rolling out the tier-aware processing system to production.

**System Status:** Ready for deployment
**Risk Level:** LOW (feature flags enabled, gradual rollout strategy)
**Rollback Time:** < 5 minutes
**Estimated Total Rollout Time:** 2-4 weeks

---

## 🎯 Rollout Strategy

### Phase Timeline

| Week | Phase | Actions | Percentage |
|------|-------|---------|------------|
| Week 1 | Deploy (Flags OFF) | Deploy all code with flags disabled | 0% |
| Week 2 | Canary Testing | Enable for 1-2 admin users | <1% |
| Week 3 | Beta Testing | Stage 1-2 rollout | 5-25% |
| Week 4 | Gradual Rollout | Stage 3-5 rollout | 25-100% |

---

## 📦 Pre-Deployment Checklist

### Infrastructure
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] RLS policies verified
- [ ] Feature flags table populated
- [ ] Tier config table populated
- [ ] All flags set to `is_enabled: false`

### Code
- [ ] Frontend build successful (`npm run build`)
- [ ] TypeScript compilation clean
- [ ] No console errors
- [ ] All tier components integrated

### Monitoring
- [ ] Health check endpoint deployed
- [ ] Admin monitoring page accessible
- [ ] Logging configured
- [ ] Alert channels ready

### Scripts
- [ ] `verify-tier-deployment.sh` tested
- [ ] `gradual-rollout.sh` accessible
- [ ] `emergency-rollback.sh` ready

---

## 🚀 Deployment Process

### Step 1: Verify Environment Variables

```bash
# Check required env vars
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
echo $SUPABASE_SERVICE_ROLE_KEY
```

All three must be set and valid.

### Step 2: Run Pre-Deployment Verification

```bash
cd scripts
chmod +x verify-tier-deployment.sh
./verify-tier-deployment.sh
```

**Expected Output:**
```
✓ PASSED: 15
✗ FAILED: 0
⚠ WARNINGS: 2-3

✅ DEPLOYMENT VERIFICATION PASSED
```

If any checks fail, fix them before proceeding.

### Step 3: Deploy to Production

```bash
# Build frontend
npm run build

# Deploy (method depends on your hosting)
# Example for Netlify:
netlify deploy --prod

# Verify deployment
curl -I https://your-domain.com
```

### Step 4: Verify Deployment

```bash
# Run verification again in production
VITE_SUPABASE_URL=https://prod-url.supabase.co \
VITE_SUPABASE_ANON_KEY=your-anon-key \
./verify-tier-deployment.sh
```

### Step 5: Smoke Test

1. Log in as admin user
2. Visit `/admin-tier-monitoring`
3. Verify health check shows "healthy"
4. Visit `/admin-feature-flags`
5. Verify all tier flags show as DISABLED
6. Try uploading a small PDF
7. Verify it processes normally (legacy mode)

---

## 🔄 Gradual Rollout Stages

### Stage 0: Pre-flight Checks (Day 0)

**Goal:** Verify system health before enabling features

```bash
./gradual-rollout.sh
# Select: 0) Stage 0: Pre-flight checks
```

**Checks:**
- ✅ Database connectivity
- ✅ Feature flags accessible
- ✅ Tier configs present
- ✅ Edge functions deployed
- ✅ No recent failures

**Success Criteria:**
- All checks pass
- System status: "healthy"

---

### Stage 1: SMALL Tier Only (Days 1-3)

**Goal:** Enable tier system for smallest documents only (< 100 pages)
**User Impact:** ~5% of uploads
**Monitoring Duration:** 72 hours minimum

```bash
./gradual-rollout.sh
# Select: 1) Stage 1: Enable SMALL tier only
```

**What This Enables:**
- `tier_system_enabled`: true
- `tier_small_enabled`: true
- All other tiers: false

**Monitoring Checklist:**

| Metric | Target | Alert If |
|--------|--------|----------|
| Success Rate | > 95% | < 90% |
| Avg Processing Time | < 60s | > 120s |
| Error Rate | < 5% | > 10% |
| System Health | Healthy | Degraded/Unhealthy |

**How to Monitor:**
1. Visit `/admin-tier-monitoring`
2. Check "Tier Performance" section
3. Watch for SMALL tier stats
4. Review logs every 4 hours
5. Check Supabase dashboard for errors

**Success Criteria:**
- ✅ Success rate > 95%
- ✅ No critical errors
- ✅ Performance within targets
- ✅ No user complaints

**If Issues Occur:**
```bash
./emergency-rollback.sh
# Type 'YES' to confirm
```

---

### Stage 2: SMALL + MEDIUM Tiers (Days 4-7)

**Goal:** Expand to medium documents (100-500 pages)
**User Impact:** ~25% of uploads
**Monitoring Duration:** 96 hours minimum

```bash
./gradual-rollout.sh
# Select: 2) Stage 2: Enable MEDIUM tier
```

**What This Enables:**
- `tier_medium_enabled`: true
- (SMALL remains enabled)

**New Metrics to Watch:**
- MEDIUM tier success rate
- MEDIUM tier avg processing time
- Comparison: MEDIUM vs legacy performance

**Success Criteria:**
- ✅ SMALL tier remains stable
- ✅ MEDIUM tier success rate > 95%
- ✅ Processing time improvement vs legacy
- ✅ No resource exhaustion

---

### Stage 3: SMALL + MEDIUM + LARGE Tiers (Days 8-11)

**Goal:** Expand to large documents (500-2000 pages)
**User Impact:** ~50% of uploads
**Monitoring Duration:** 96 hours minimum

```bash
./gradual-rollout.sh
# Select: 3) Stage 3: Enable LARGE tier
```

**What This Enables:**
- `tier_large_enabled`: true
- (SMALL + MEDIUM remain enabled)

**Key Metrics:**
- Chunking efficiency
- Parallel processing performance
- Database load
- Edge function concurrency

**Success Criteria:**
- ✅ Previous tiers remain stable
- ✅ LARGE tier success rate > 90%
- ✅ Chunking working correctly
- ✅ No database bottlenecks

---

### Stage 4: All Except MASSIVE (Days 12-15)

**Goal:** Enable XLARGE tier (2000-5000 pages)
**User Impact:** ~75% of uploads
**Monitoring Duration:** 96 hours minimum

```bash
./gradual-rollout.sh
# Select: 4) Stage 4: Enable XLARGE tier
```

**What This Enables:**
- `tier_xlarge_enabled`: true
- (All smaller tiers remain enabled)

**Critical Metrics:**
- Queue management efficiency
- Hierarchical consolidation performance
- Long-running process stability
- Checkpoint recovery success

**Success Criteria:**
- ✅ All previous tiers stable
- ✅ XLARGE tier success rate > 85%
- ✅ Queue system working correctly
- ✅ Consolidation efficient

---

### Stage 5: Full Rollout (Days 16-20)

**Goal:** Enable MASSIVE tier (5000+ pages)
**User Impact:** 100% of uploads
**Monitoring Duration:** 120 hours minimum

```bash
./gradual-rollout.sh
# Select: 5) Stage 5: Enable MASSIVE tier
```

**What This Enables:**
- `tier_massive_enabled`: true
- **ALL TIERS NOW ACTIVE**

**Ultra-Critical Metrics:**
- MASSIVE tier completion rate
- Resource consumption
- Cost per process
- Overall system stability

**Success Criteria:**
- ✅ All tiers performing well
- ✅ MASSIVE tier success rate > 80%
- ✅ System handles largest docs
- ✅ Cost within budget
- ✅ No critical incidents

**🎉 FULL ROLLOUT COMPLETE!**

---

## 🚨 Emergency Rollback

### When to Rollback

Execute emergency rollback if:
- ❌ Success rate drops below 80%
- ❌ Multiple critical errors
- ❌ Database performance degraded
- ❌ User complaints spike
- ❌ Cost exceeds budget by 50%
- ❌ Data integrity issues

### Rollback Procedure

```bash
./emergency-rollback.sh
# Type 'YES' to confirm

# Expected: All flags disabled in < 30 seconds
```

**Post-Rollback Actions:**
1. ✅ Verify all flags disabled
2. ✅ Check system reverted to legacy
3. ✅ Test upload works
4. 📝 Document incident
5. 🔍 Root cause analysis
6. 🛠️ Fix issues
7. ✅ Test in staging
8. 🔄 Plan re-rollout

---

## 📊 Monitoring Dashboard

### Access

```
URL: https://your-domain.com/admin-tier-monitoring
Required Role: Admin
```

### Key Sections

**1. Overall Health Status**
- Visual indicator (green/yellow/red)
- Component health breakdown
- Latency metrics

**2. Feature Flags Status**
- Which tiers are enabled
- Master toggle status

**3. Tier Performance (Last 7 Days)**
- Total processes per tier
- Success/failure counts
- Average processing time
- Success rate percentage

**4. Recent Processing Activity**
- Last 24h statistics
- Failure rate trending

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Success Rate | < 95% | < 90% |
| Failure Rate | > 5% | > 10% |
| Avg Time (SMALL) | > 60s | > 120s |
| Avg Time (MEDIUM) | > 5min | > 10min |
| Avg Time (LARGE) | > 15min | > 30min |
| System Health | Degraded | Unhealthy |

---

## 🔧 Troubleshooting

### Issue: Health Check Fails

**Symptoms:**
- Status shows "unhealthy"
- One or more components red

**Diagnosis:**
```bash
curl -X GET \
  "$VITE_SUPABASE_URL/functions/v1/tier-system-health-check" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" | jq '.'
```

**Solutions:**
1. Check database connectivity
2. Verify edge functions deployed
3. Check RLS policies
4. Review recent migrations

---

### Issue: Tier Not Processing

**Symptoms:**
- Flag enabled but tier not being used
- All processes still using legacy mode

**Diagnosis:**
```sql
SELECT flag_key, is_enabled
FROM feature_flags
WHERE flag_key LIKE 'tier_%';

SELECT tier_name, is_active
FROM processing_tier_config;
```

**Solutions:**
1. Verify `tier_system_enabled` is true
2. Check specific tier flag is true
3. Verify tier config `is_active` is true
4. Clear frontend cache
5. Check browser console for errors

---

### Issue: High Failure Rate

**Symptoms:**
- Success rate < 90%
- Many processes stuck in "error" status

**Diagnosis:**
```sql
SELECT
  detected_tier,
  status,
  COUNT(*) as count
FROM processos
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY detected_tier, status
ORDER BY detected_tier, status;
```

**Solutions:**
1. Check logs for specific error patterns
2. Review failed processes manually
3. Verify edge function logs
4. Check for timeout issues
5. Consider rollback if severe

---

### Issue: Performance Degradation

**Symptoms:**
- Processing time increased significantly
- Queue buildup
- Timeouts

**Diagnosis:**
```sql
SELECT
  tier_name,
  AVG(avg_processing_time_seconds) as avg_time,
  MAX(avg_processing_time_seconds) as max_time
FROM tier_usage_stats
WHERE date > CURRENT_DATE - 7
GROUP BY tier_name;
```

**Solutions:**
1. Check database CPU/memory
2. Review edge function concurrency
3. Check for deadlocks
4. Verify checkpoint system working
5. Scale infrastructure if needed

---

## 📈 Success Metrics

### Quantitative Targets

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Overall Success Rate | > 95% | > 98% |
| Processing Time Reduction | > 20% | > 40% |
| Cost Efficiency | Neutral | -10% |
| User Complaints | < 5/week | 0 |
| Rollback Events | 0 | 0 |

### Qualitative Goals

- ✅ Smooth rollout with no critical incidents
- ✅ Team confident in system
- ✅ Users notice improved speed
- ✅ Documentation accurate and helpful
- ✅ Monitoring tools effective

---

## 🎓 Post-Rollout

### Week 1 After Full Rollout

- [ ] Daily monitoring review
- [ ] Document any issues encountered
- [ ] Fine-tune tier thresholds if needed
- [ ] Gather user feedback
- [ ] Review cost metrics

### Week 2-4 After Full Rollout

- [ ] Reduce monitoring frequency to weekly
- [ ] Analyze performance improvements
- [ ] Plan optimization opportunities
- [ ] Update documentation based on learnings
- [ ] Celebrate success! 🎉

### Long-term

- [ ] Monthly tier performance review
- [ ] Quarterly optimization sprints
- [ ] Annual architecture review
- [ ] Continuous improvement based on data

---

## 📞 Support Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Critical Production Issue | [ON-CALL] | < 30 min |
| Rollback Decision | [TEAM LEAD] | < 1 hour |
| Performance Issues | [DEVOPS] | < 4 hours |
| Feature Questions | [PRODUCT] | < 1 day |

---

## 📚 Additional Resources

- [Tier System Architecture](./docs/TIER_SYSTEM_OVERVIEW.md)
- [Database Schema](./docs/04-BANCO-DE-DADOS.md)
- [Edge Functions](./docs/05-EDGE-FUNCTIONS.md)
- [Feature Flags Guide](./docs/FEATURE_FLAGS_GUIDE.md)

---

## ✅ Rollout Sign-off

### Pre-Deployment

- [ ] Technical Lead Approval
- [ ] QA Sign-off
- [ ] Product Manager Approval
- [ ] Infrastructure Ready

### Post-Deployment (Each Stage)

- [ ] Stage Completed Successfully
- [ ] Metrics Within Targets
- [ ] No Critical Issues
- [ ] Ready for Next Stage

---

**Last Updated:** 2025-12-05
**Version:** 1.0.0
**Status:** Ready for Production Rollout
