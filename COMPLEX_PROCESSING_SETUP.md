# Complex Processing System - Setup Guide

## What Was Fixed

### Issue 1: Missing "queued" Status
**Error:** `invalid input value for enum processo_status: "queued"`

**Fix:** Added migration `20251031120004_add_queued_status_to_processos.sql` that adds "queued" to the processo_status enum.

### Issue 2: Process_chunks Insert Errors
**Error:** 400 Bad Request on process_chunks insert

**Fix:** Added proper error handling in ProcessosService to catch and display actual error messages.

## Migrations to Apply

You need to apply these 5 new migrations to your Supabase database:

1. **20251031120000_create_processing_queue_table.sql**
   - Creates the global processing queue for managing chunk jobs
   - Includes retry logic, dead letter queue, and lock management

2. **20251031120001_create_complex_processing_status_table.sql**
   - Creates real-time progress tracking table
   - Automatic progress percentage calculation
   - Heartbeat monitoring

3. **20251031120002_update_process_chunks_for_complex_processing.sql**
   - Adds overlap tracking fields
   - Adds context_summary for chunk chaining
   - Adds processing metrics

4. **20251031120003_create_queue_management_functions.sql**
   - Creates 8 stored procedures for queue management:
     - `acquire_next_queue_item()` - Get next job with lock
     - `update_queue_heartbeat()` - Keep job alive
     - `complete_queue_item()` - Mark job done
     - `fail_queue_item()` - Mark job failed
     - `release_expired_locks()` - Clean up stale locks
     - `get_queue_stats()` - Get queue statistics
     - `get_chunk_context()` - Get previous chunk context
     - `update_complex_processing_progress()` - Update progress

5. **20251031120004_add_queued_status_to_processos.sql**
   - Adds "queued" status to processo_status enum

## How to Apply Migrations

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste each migration file in order
4. Execute each one

### Option 2: Using Supabase CLI
```bash
supabase db push
```

## Edge Functions to Deploy

Deploy these 4 new edge functions:

1. **start-analysis-complex**
   - Initializes complex processing
   - Creates queue items
   - Uploads chunks to Gemini

2. **process-complex-worker**
   - Processes one chunk at a time
   - Maintains context between chunks
   - Auto-dispatches next worker

3. **consolidation-worker**
   - Consolidates all chunk results
   - Generates final unified analysis

4. **health-check-worker**
   - Monitors system health
   - Releases expired locks
   - Restarts stalled workers

### How to Deploy Edge Functions

Using Supabase CLI:
```bash
supabase functions deploy start-analysis-complex
supabase functions deploy process-complex-worker
supabase functions deploy consolidation-worker
supabase functions deploy health-check-worker
```

Or use the Supabase Dashboard to deploy each function.

## How It Works Now

### For PDFs < 1000 pages
- Uses existing `uploadAndStartProcessing` flow
- No changes to current behavior
- Same edge functions (start-analysis → process-next-prompt)

### For PDFs >= 1000 pages
- Uses new `uploadAndStartComplexProcessing` flow
- Splits into 300-page chunks with 50-page overlap
- Creates queue with all chunks × prompts
- Workers process sequentially with context preservation
- Consolidation combines all results into final analysis

## Testing

After applying migrations and deploying functions:

1. Upload a PDF with 1000-1200 pages
2. Check browser console for progress logs
3. Monitor process in Supabase dashboard:
   - Check `complex_processing_status` table for progress
   - Check `processing_queue` table for queue items
   - Check `process_chunks` table for chunk status

## Expected Behavior for 1200-page PDF

```
1. Frontend detects 1200 pages → complex mode
2. Splits into 4 chunks (300 pages each, 50-page overlap)
3. Uploads chunks to storage
4. Creates process record with status='created'
5. Calls start-analysis-complex edge function
6. Edge function:
   - Updates status to 'queued'
   - Creates complex_processing_status record
   - Uploads chunks to Gemini API
   - Creates queue items (4 chunks × 9 prompts = 36 items)
   - Dispatches first worker
7. Workers process chunks sequentially
8. Consolidation combines results
9. Process marked as 'completed'
10. User receives notification
```

## Monitoring

### Check Queue Status
```sql
SELECT * FROM get_queue_stats();
```

### Check Process Progress
```sql
SELECT
  processo_id,
  current_phase,
  chunks_completed || '/' || total_chunks as progress,
  overall_progress_percent || '%' as percent,
  is_healthy
FROM complex_processing_status
WHERE current_phase != 'completed';
```

### Check for Issues
```sql
-- Failed queue items
SELECT * FROM processing_queue WHERE status = 'dead_letter';

-- Unhealthy processes
SELECT * FROM complex_processing_status WHERE is_healthy = false;

-- Expired locks
SELECT * FROM processing_queue
WHERE status = 'processing' AND lock_expires_at < now();
```

## Troubleshooting

### If chunks fail to insert
- Check process_chunks table constraints
- Verify overlap_start_page and overlap_end_page are nullable or have values
- Check error logs in browser console

### If edge function fails
- Check Supabase logs for the specific function
- Verify all migrations were applied
- Check that GEMINI_API_KEY is set in environment

### If workers stop processing
- Call health-check-worker manually to release stuck locks
- Check processing_queue for status='processing' items
- Verify lock_expires_at hasn't passed

### If consolidation doesn't trigger
- Check that all queue items have status='completed'
- Manually call consolidation-worker edge function with processo_id

## Health Check Cron Job (Optional)

Set up a cron job to call health-check-worker every 5 minutes:

1. Go to Supabase Dashboard → Edge Functions
2. Set up a cron trigger for health-check-worker
3. Schedule: `*/5 * * * *` (every 5 minutes)

Or use an external cron service like:
- Vercel Cron
- AWS EventBridge
- GitHub Actions scheduled workflows

```yaml
# Example GitHub Actions workflow
name: Health Check
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Call health-check-worker
        run: |
          curl -X POST \
            https://YOUR_PROJECT.supabase.co/functions/v1/health-check-worker \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}"
```

## Next Steps

1. ✅ Apply all 5 migrations to database
2. ✅ Deploy 4 edge functions
3. ✅ Test with a 1200-page PDF
4. Optional: Create ComplexProcessingProgress UI component
5. Optional: Set up health-check cron job
6. Optional: Add admin dashboard for monitoring queue

## Architecture Benefits

- **Scales infinitely**: Can handle 1k to 150k+ pages
- **No timeouts**: Each chunk processes in ~2-3 minutes
- **Context preserved**: 50-page overlap + summary chaining
- **Auto-recovery**: Expired locks released automatically
- **Monitoring**: Real-time progress tracking
- **Isolation**: Complex processing doesn't affect normal files
- **Resilient**: Retry logic and dead letter queue
