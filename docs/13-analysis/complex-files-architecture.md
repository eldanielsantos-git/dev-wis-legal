# Complex Files Processing Architecture

This document provides a comprehensive technical reference for the complex files processing system. It covers the complete architecture, data flow, edge functions, database schema, and automatic recovery mechanisms.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Processing Flow](#2-processing-flow)
3. [Edge Functions Reference](#3-edge-functions-reference)
4. [Database Schema](#4-database-schema)
5. [Automatic Recovery System](#5-automatic-recovery-system)
6. [GitHub Actions Cron Jobs](#6-github-actions-cron-jobs)
7. [State Machine](#7-state-machine)
8. [Error Handling](#8-error-handling)
9. [Performance Considerations](#9-performance-considerations)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
                                    COMPLEX FILES PROCESSING SYSTEM
                                    ================================

    +------------------+     +------------------+     +------------------+
    |   PDF Upload     |---->|   PDF Chunking   |---->|  Gemini Upload   |
    |   (Frontend)     |     |  (split-pdf)     |     | (upload-chunks)  |
    +------------------+     +------------------+     +------------------+
                                                              |
                                                              v
    +------------------+     +------------------+     +------------------+
    |   Notification   |<----|  Consolidation   |<----|   AI Processing  |
    |   (Email/Push)   |     | (consolidation)  |     | (process-worker) |
    +------------------+     +------------------+     +------------------+
                                      ^                       |
                                      |                       |
                            +------------------+              |
                            | GitHub Actions   |<-------------+
                            | (Recovery Crons) |
                            +------------------+
```

### 1.2 Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Resilience** | Multi-layer automatic recovery system |
| **Scalability** | Parallel workers with concurrency control |
| **Observability** | Heartbeat monitoring and health checks |
| **Data Integrity** | Chunk validation before consolidation |
| **Fault Tolerance** | Dead letter queue for unrecoverable items |

### 1.3 Processing Thresholds

| Parameter | Value | Description |
|-----------|-------|-------------|
| Max chunk size | 15 MB | Maximum size per PDF chunk |
| Overlap pages | 75 pages | Context overlap between chunks |
| Max file size (auto) | 60 MB | Maximum for automatic processing |
| Lock duration | 15 minutes | Worker lock timeout |
| Stuck threshold | 15 minutes | Time before process is considered stuck |
| Gemini TTL | 48 hours | Time before uploaded files expire |
| Max attempts | 3 | Maximum retry attempts per queue item |

---

## 2. Processing Flow

### 2.1 Complete Flow Diagram

```
PHASE 1: UPLOAD & CHUNKING
==========================

[User Upload]
     |
     v
[processos] status='created'
     |
     v
+------------------------+
| split-pdf-chunks       |
| - Load PDF             |
| - Calculate chunk size |
| - Split with overlap   |
| - Upload to Storage    |
+------------------------+
     |
     v
[process_chunks] status='ready'
     |
     v
[processos] is_chunked=true


PHASE 2: INITIALIZATION
=======================

+------------------------+
| start-analysis-complex |
| - Validate processo    |
| - Create status record |
| - Load active prompts  |
| - Create analysis_results|
| - Dispatch upload worker|
+------------------------+
     |
     v
[complex_processing_status] current_phase='initializing'
[analysis_results] status='pending' (N records for N prompts)
     |
     v
+------------------------+
| upload-chunks-worker   |
| - Download from Storage|
| - Upload to Gemini     |
| - Wait for ACTIVE state|
| - Create processing_queue|
| - Dispatch workers     |
+------------------------+
     |
     v
[process_chunks] gemini_file_state='ACTIVE'
[processing_queue] status='pending' (N chunks x M prompts items)
[complex_processing_status] current_phase='processing'


PHASE 3: AI PROCESSING
======================

+------------------------+
| process-complex-worker |  <-- Multiple parallel workers
| - Acquire queue item   |
| - Register worker      |
| - Send heartbeats      |
| - Call Gemini API      |
| - Generate context     |
| - Update results       |
| - Spawn next worker    |
+------------------------+
     |
     v
[processing_queue] status='completed'
[process_chunks] processing_result={...}
     |
     +-- All chunks for prompt done?
             |
             v
+------------------------+
| consolidation-worker   |
| - Validate integrity   |
| - Consolidate chunks   |
| - Call Gemini for final|
| - Update analysis_results|
+------------------------+
     |
     v
[analysis_results] status='completed', result_content={...}


PHASE 4: COMPLETION
===================

     All prompts consolidated?
             |
             v
[processos] status='completed'
[complex_processing_status] current_phase='completed'
     |
     v
+------------------------+
| Notifications          |
| - In-app notification  |
| - Email notification   |
| - Admin Slack alert    |
+------------------------+
```

### 2.2 Chunk Processing Strategy

```
PDF Document (1000 pages)
=========================

Chunk Size Calculation:
  avg_bytes_per_page = file_size / total_pages
  pages_per_chunk = MIN(100, MAX(10, 15MB / avg_bytes_per_page))

Example with 100MB file, 1000 pages:
  avg = 100KB/page
  pages_per_chunk = MIN(100, MAX(10, 15MB/100KB)) = 100 pages
  total_chunks = CEIL(1000/100) = 10 chunks

With Overlap (75 pages):
  Chunk 1: Pages 1-100
  Chunk 2: Pages 26-200 (overlap: 26-100)
  Chunk 3: Pages 126-300 (overlap: 126-200)
  ...

Processing Order (by execution_order):
  Prompt 1 (execution_order=1): All chunks processed -> Consolidated
  Prompt 2 (execution_order=2): All chunks processed -> Consolidated
  ...
  Prompt N (execution_order=N): All chunks processed -> Consolidated
```

---

## 3. Edge Functions Reference

### 3.1 Core Processing Functions

#### split-pdf-chunks

**Purpose:** Divides large PDF files into manageable chunks with overlap.

**Trigger:** Called after file upload when `total_pages > threshold`

**Input:**
```typescript
{
  processo_id: string;
  start_from_chunk?: number; // For resuming interrupted splits
}
```

**Key Operations:**
1. Download original PDF from Storage
2. Calculate optimal chunk size based on file size
3. Split PDF with 75-page overlap for context continuity
4. Upload each chunk to Storage
5. Create `process_chunks` records with status='ready'

**Output:**
```typescript
{
  success: boolean;
  totalChunks: number;
  totalPages: number;
  chunkSize: number;
  duration: string;
}
```

---

#### start-analysis-complex

**Purpose:** Initializes the complex analysis pipeline.

**Trigger:** Called when user starts analysis of a chunked file.

**Input:**
```typescript
{
  processo_id: string;
}
```

**Key Operations:**
1. Validate processo exists and is chunked
2. Update status to 'queued'
3. Create `complex_processing_status` record
4. Load active analysis prompts
5. Create `analysis_results` records (one per prompt)
6. Dispatch `upload-chunks-worker`

**State Transitions:**
```
processos.status: created -> queued
complex_processing_status.current_phase: -> initializing
```

---

#### upload-chunks-worker

**Purpose:** Uploads PDF chunks to Gemini File API and creates processing queue.

**Trigger:** Dispatched by `start-analysis-complex`

**Input:**
```typescript
{
  processo_id: string;
}
```

**Key Operations:**
1. Load all chunks for processo
2. For each chunk:
   - Download from Supabase Storage
   - Upload to Gemini File API
   - Wait for ACTIVE state (up to 10 minutes)
   - Update `process_chunks` with Gemini URI
3. Create `processing_queue` items (chunks x prompts)
4. Dispatch `process-complex-worker`

**Queue Item Creation:**
```typescript
// For each chunk, for each prompt:
{
  processo_id: string;
  chunk_id: string;
  prompt_id: string;
  queue_type: 'chunk_processing';
  priority: prompt.execution_order;
  status: 'pending';
  prompt_content: string;
  context_data: {
    chunk_index: number;
    total_chunks: number;
    has_previous_context: boolean;
    prompt_title: string;
  };
  max_attempts: 3;
}
```

---

#### process-complex-worker

**Purpose:** Processes individual queue items by calling Gemini API.

**Trigger:** Dispatched by `upload-chunks-worker`, self-spawning, or recovery crons.

**Key Operations:**
1. Acquire next queue item using `acquire_next_queue_item` RPC
2. Register worker with `register_worker` RPC
3. Start heartbeat interval (30 seconds)
4. Wait for chunk to be ACTIVE in Gemini
5. Load context from previous chunk if available
6. Call Gemini API with prompt and PDF
7. Generate context summary for next chunk
8. Update `process_chunks` with results
9. Complete queue item with `complete_queue_item` RPC
10. Check if all chunks for prompt are done
11. If done, dispatch `consolidation-worker`
12. If more items, spawn another worker

**Concurrency Control:**
```
max_concurrent_workers: 5 (default)
Controlled by: complex_processing_status.max_concurrent_workers
Workers tracked in: complex_processing_status.active_worker_ids
```

**Model Fallback:**
```
1. Try primary model (highest priority)
2. On error, try next model
3. Continue until success or all models exhausted
4. If all fail, mark item for retry
```

---

#### consolidation-worker

**Purpose:** Consolidates chunk results into final analysis.

**Trigger:** Dispatched when all chunks for a prompt are completed.

**Input:**
```typescript
{
  processo_id: string;
  prompt_id?: string; // Optional: consolidate specific prompt
}
```

**Key Operations:**
1. Update phase to 'consolidating'
2. Validate chunks integrity with `validate_chunks_integrity` RPC
3. Load all chunk results
4. Combine results for LLM consolidation
5. Call Gemini API with combined context
6. Update `analysis_results` with final content
7. Check if all prompts are consolidated
8. If all done, mark processo as completed
9. Send notifications (email, push, admin)

**Integrity Validation:**
```sql
-- Checks that all chunks:
-- 1. Have gemini_file_uri
-- 2. Have gemini_file_state = 'ACTIVE'
-- 3. Are not in 'failed' status
```

---

### 3.2 Recovery Functions

#### health-check-worker

**Purpose:** Monitors system health and triggers recovery actions.

**Trigger:** GitHub Actions cron every 5 minutes.

**Key Operations:**
1. Release expired locks using `release_expired_locks` RPC
2. Detect processes without recent heartbeat
3. Mark unhealthy processes
4. Trigger workers for processes with pending items
5. Process retry queue items
6. Report dead letter queue items

---

#### recover-stuck-chunks

**Purpose:** Recovers chunks stuck in processing states.

**Trigger:** GitHub Actions cron every 5 minutes.

**Input:**
```typescript
{
  threshold_minutes?: number; // Default: 15
}
```

**Key Operations:**
1. Clean up orphan chunks older than 48 hours
2. Find stuck chunks using `get_stuck_chunks` RPC
3. Recover chunks using `recover_stuck_chunks` RPC
4. Dispatch workers for affected processos

**Stuck Chunk Criteria:**
```sql
status IN ('retry', 'failed', 'processing')
AND attempt_number < max_attempts
AND updated_at < NOW() - threshold_minutes
AND processo.status NOT IN ('completed', 'error')
```

---

#### recover-stuck-processes

**Purpose:** Recovers processes stuck in consolidating or processing phase.

**Trigger:** GitHub Actions cron every 10 minutes.

**Key Operations:**
1. Find processes with stale heartbeat (>15 minutes)
2. For consolidating phase: dispatch consolidation-worker
3. For processing phase: dispatch process-complex-worker
4. Update heartbeat to prevent immediate re-triggering

---

#### detect-stuck-initializing

**Purpose:** Recovers processes stuck in initialization phase.

**Trigger:** GitHub Actions cron every 5 minutes.

**Key Operations:**
1. Find processes in 'initializing' phase with stale heartbeat
2. Check chunk upload status to Gemini
3. If all uploaded: create queue and start processing
4. If not uploaded: restart upload-chunks-worker

---

#### auto-restart-failed-chunks

**Purpose:** Handles chunks that exceeded token limits by subdividing.

**Trigger:** GitHub Actions cron every 3 minutes.

**Key Operations:**
1. Find chunks with `token_validation_status = 'exceeded'`
2. Subdivide into smaller chunks (~80 pages each)
3. Create new queue items for sub-chunks
4. Mark original chunk as 'subdivided'
5. Dispatch workers for new sub-chunks

---

## 4. Database Schema

### 4.1 Core Tables

#### processos (Main Process Table)

```sql
-- Key columns for complex processing
is_chunked: boolean           -- True for complex files
total_chunks_count: integer   -- Total number of chunks
chunks_uploaded_count: integer-- Progress tracking
status: text                  -- 'created', 'queued', 'completed', 'error'
analysis_started_at: timestamptz
analysis_completed_at: timestamptz
```

#### process_chunks (Chunk Storage)

```sql
CREATE TABLE process_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES processos(id),
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,

  -- Page range
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  pages_count INTEGER NOT NULL,
  overlap_start_page INTEGER,
  overlap_end_page INTEGER,

  -- Storage
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,

  -- Gemini API
  gemini_file_uri TEXT,
  gemini_file_name TEXT,
  gemini_file_state TEXT DEFAULT 'pending',
  gemini_file_uploaded_at TIMESTAMPTZ,
  gemini_file_expires_at TIMESTAMPTZ,

  -- Processing
  status TEXT NOT NULL DEFAULT 'pending',
  processing_result JSONB,
  context_summary JSONB,
  processing_time_seconds INTEGER,
  tokens_used INTEGER,

  -- Error handling
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,

  -- Subdivision
  subdivision_parent_id UUID REFERENCES process_chunks(id),
  subdivision_index INTEGER,
  estimated_tokens INTEGER,
  token_validation_status VARCHAR DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Status values:
-- 'pending': Created, waiting for upload
-- 'ready': Uploaded to storage, waiting for Gemini
-- 'processing': Being processed by worker
-- 'completed': Successfully processed
-- 'failed': Processing failed
-- 'abandoned': Expired (>48h)
-- 'subdivided': Split into smaller chunks
```

#### processing_queue (Work Queue)

```sql
CREATE TABLE processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES processos(id),
  chunk_id UUID REFERENCES process_chunks(id),

  -- Queue management
  queue_type TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  queue_position BIGSERIAL,
  status TEXT NOT NULL DEFAULT 'pending',

  -- Prompt information
  prompt_id UUID,
  prompt_content TEXT,
  context_data JSONB,

  -- Retry management
  attempt_number INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Worker coordination
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ,
  worker_id TEXT,

  -- Locking
  lock_acquired_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,
  timeout_seconds INTEGER DEFAULT 900,

  -- Results
  result_data JSONB,
  tokens_used INTEGER,
  error_message TEXT,
  error_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Status values:
-- 'pending': Waiting to be processed
-- 'processing': Currently being processed by a worker
-- 'completed': Successfully processed
-- 'retry': Failed but can be retried
-- 'failed': Failed, no more retries
-- 'dead_letter': Exceeded max attempts
```

#### complex_processing_status (Progress Tracking)

```sql
CREATE TABLE complex_processing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL UNIQUE REFERENCES processos(id),

  -- Chunk tracking
  total_chunks INTEGER NOT NULL,
  chunks_uploaded INTEGER DEFAULT 0,
  chunks_queued INTEGER DEFAULT 0,
  chunks_processing INTEGER DEFAULT 0,
  chunks_completed INTEGER DEFAULT 0,
  chunks_failed INTEGER DEFAULT 0,

  -- Phase tracking
  current_phase TEXT DEFAULT 'initializing',
  current_chunk_index INTEGER,

  -- Time tracking
  started_at TIMESTAMPTZ DEFAULT now(),
  estimated_completion_at TIMESTAMPTZ,
  average_chunk_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,

  -- Progress percentages
  upload_progress_percent INTEGER DEFAULT 0,
  processing_progress_percent INTEGER DEFAULT 0,
  overall_progress_percent INTEGER DEFAULT 0,

  -- Health monitoring
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  is_healthy BOOLEAN DEFAULT true,
  health_check_message TEXT,

  -- Worker coordination
  max_concurrent_workers INTEGER DEFAULT 5,
  current_active_workers INTEGER DEFAULT 0,
  active_worker_ids JSONB DEFAULT '[]',

  -- Statistics
  total_tokens_used BIGINT DEFAULT 0,
  total_prompts_processed INTEGER DEFAULT 0,
  total_retries INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  error_log JSONB[] DEFAULT ARRAY[]::JSONB[],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- current_phase values:
-- 'initializing': Setting up processing
-- 'uploading': Uploading chunks to Gemini
-- 'processing': Chunks being processed
-- 'consolidating': Consolidating results
-- 'completed': All done
-- 'abandoned': Expired without completion
```

#### analysis_results (Final Results)

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES processos(id),
  prompt_id UUID NOT NULL,
  prompt_title TEXT NOT NULL,
  prompt_content TEXT,
  system_prompt TEXT,

  -- Execution
  execution_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',

  -- Results
  result_content TEXT,
  tokens_used INTEGER,
  execution_time_ms INTEGER,

  -- Model tracking
  current_model_id UUID,
  current_model_name TEXT,
  failed_models JSONB DEFAULT '[]',

  -- Retry tracking
  attempt_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- Error handling
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  processing_at TIMESTAMPTZ
);

-- status values:
-- 'pending': Waiting to be processed
-- 'running': Currently being consolidated
-- 'completed': Successfully completed
-- 'failed': Failed to complete
```

### 4.2 Key Database Functions (RPCs)

#### acquire_next_queue_item

```sql
-- Atomically acquires the next available queue item
-- Uses SELECT FOR UPDATE SKIP LOCKED for concurrency safety
-- Prioritizes by prompt execution_order, then by priority and position

FUNCTION acquire_next_queue_item(
  p_worker_id TEXT,
  p_lock_duration_minutes INTEGER DEFAULT 15
) RETURNS TABLE (
  id UUID,
  processo_id UUID,
  chunk_id UUID,
  queue_type TEXT,
  context_data JSONB,
  prompt_id UUID,
  prompt_content TEXT,
  attempt_number INTEGER
)
```

#### release_expired_locks

```sql
-- Releases locks that have expired
-- Moves items to 'retry' or 'dead_letter' based on attempt count

FUNCTION release_expired_locks()
RETURNS TABLE (
  released_count INTEGER,
  moved_to_retry INTEGER,
  moved_to_dead_letter INTEGER
)
```

#### validate_chunks_integrity

```sql
-- Validates all chunks are ready for consolidation
-- Checks Gemini URI, state, and status

FUNCTION validate_chunks_integrity(p_processo_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  total_chunks INTEGER,
  valid_chunks INTEGER,
  invalid_chunk_count INTEGER,
  invalid_chunks JSONB
)
```

#### can_spawn_worker

```sql
-- Checks if a new worker can be spawned
-- Based on max_concurrent_workers and pending items

FUNCTION can_spawn_worker(p_processo_id UUID)
RETURNS BOOLEAN
```

#### register_worker / unregister_worker

```sql
-- Manages worker registration for concurrency control
-- Tracks active workers in complex_processing_status

FUNCTION register_worker(p_processo_id UUID, p_worker_id TEXT)
RETURNS BOOLEAN

FUNCTION unregister_worker(p_processo_id UUID, p_worker_id TEXT)
RETURNS VOID
```

---

## 5. Automatic Recovery System

### 5.1 Recovery Architecture

```
                    AUTOMATIC RECOVERY SYSTEM
                    =========================

   +------------------------------------------------------------+
   |                    GitHub Actions Crons                      |
   +------------------------------------------------------------+
           |              |              |              |
           v              v              v              v
   +-------------+ +-------------+ +-------------+ +-------------+
   | Stuck Init  | | Stuck Procs | | Stuck Chunks| | Failed      |
   | (5 min)     | | (10 min)    | | (5 min)     | | Chunks(3min)|
   +-------------+ +-------------+ +-------------+ +-------------+
           |              |              |              |
           v              v              v              v
   +------------------------------------------------------------+
   |                    Edge Functions                           |
   +------------------------------------------------------------+
   | detect-stuck-  | recover-stuck- | recover-stuck-| auto-restart|
   | initializing   | processes      | chunks        | -failed-    |
   |                |                |               | chunks      |
   +------------------------------------------------------------+
           |              |              |              |
           v              v              v              v
   +------------------------------------------------------------+
   |                    Worker Dispatch                          |
   +------------------------------------------------------------+
   | upload-chunks- | consolidation- | process-      | process-   |
   | worker         | worker         | complex-worker| complex-   |
   |                |                |               | worker     |
   +------------------------------------------------------------+
```

### 5.2 Recovery Scenarios

| Scenario | Detection | Recovery Action |
|----------|-----------|-----------------|
| Process stuck in `initializing` | Heartbeat > 15 min | Restart upload-chunks-worker |
| Process stuck in `processing` | Heartbeat > 15 min | Dispatch process-complex-worker |
| Process stuck in `consolidating` | Heartbeat > 15 min | Dispatch consolidation-worker |
| Chunk stuck in `processing` | Updated > 10 min | Reset to `pending`, trigger worker |
| Chunk in `retry` status | Any | Dispatch worker |
| Chunk in `dead_letter` | Exceeded max attempts | Log, skip (manual intervention) |
| Chunk with token limit exceeded | `token_validation_status='exceeded'` | Subdivide into smaller chunks |
| Expired Gemini files (>48h) | Created > 48h ago | Mark as `abandoned` |
| Worker lock expired | `lock_expires_at < now()` | Release lock, move to retry |

### 5.3 Health Check Flow

```
health-check-worker (every 5 minutes)
=====================================

1. RELEASE EXPIRED LOCKS
   - Find: processing_queue.lock_expires_at < now()
   - Action: Reset to 'retry' or 'dead_letter'
   - Update: Clear worker_id, lock timestamps

2. DETECT UNHEALTHY PROCESSES
   - Find: complex_processing_status.last_heartbeat < 15 min ago
   - Action: Mark is_healthy = false
   - Trigger: process-complex-worker if pending items exist

3. PROCESS RETRY QUEUE
   - Find: processing_queue.status = 'retry'
   - Action: Dispatch workers for unique processos
   - Limit: 5 processos per run

4. REPORT DEAD LETTER QUEUE
   - Find: processing_queue.status = 'dead_letter'
   - Action: Log details for manual review
```

---

## 6. GitHub Actions Cron Jobs

### 6.1 Cron Schedule Overview

| Workflow | Cron | Function Called | Purpose |
|----------|------|-----------------|---------|
| `monitor-stuck-initializing` | `*/5 * * * *` | `detect-stuck-initializing` | Recover init phase |
| `monitor-complex-health-check` | `*/5 * * * *` | `health-check-worker` | General health |
| `monitor-stuck-chunks` | `*/5 * * * *` | `recover-stuck-chunks` | Recover stuck chunks |
| `monitor-complex-recovery` | `*/10 * * * *` | `recover-stuck-processes` | Recover processes |
| `monitor-auto-restart-failed` | `*/3 * * * *` | `auto-restart-failed-chunks` | Handle token limits |
| `monitor-stuck-small-files` | `*/5 * * * *` | `detect-stuck-processes-small-files` | Small file recovery |

### 6.2 Workflow Configuration

```yaml
# Example: monitor-stuck-initializing.yml
name: Monitor Stuck Initializing

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:        # Manual trigger

jobs:
  detect-stuck:
    runs-on: ubuntu-latest
    steps:
      - name: Detect and fix stuck initializing processes
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/detect-stuck-initializing" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json")

          # Parse response and handle errors
```

### 6.3 Required Secrets

```
SUPABASE_URL: Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY: Service role key for admin operations
```

---

## 7. State Machine

### 7.1 Process States

```
                    PROCESS STATE MACHINE
                    =====================

    +--------+     +---------+     +--------+     +-----------+
    | created|---->| queued  |---->|analyzing|--->| completed |
    +--------+     +---------+     +--------+     +-----------+
         |              |              |               ^
         |              v              v               |
         |         +--------+     +--------+          |
         +-------->| error  |<----| error  |----------+
                   +--------+     +--------+
```

### 7.2 Processing Phase States

```
                    PHASE STATE MACHINE
                    ===================

    +-------------+     +----------+     +------------+
    | initializing|---->| uploading|---->| processing |
    +-------------+     +----------+     +------------+
          |                  |                  |
          v                  v                  v
    +-------------+     +----------+     +------------+
    | abandoned   |     | abandoned|     |consolidating|
    +-------------+     +----------+     +------------+
                                               |
                                               v
                                         +----------+
                                         | completed|
                                         +----------+
```

### 7.3 Queue Item States

```
                    QUEUE ITEM STATE MACHINE
                    ========================

    +---------+     +------------+     +-----------+
    | pending |---->| processing |---->| completed |
    +---------+     +------------+     +-----------+
         ^               |
         |               v
    +---------+     +--------+     +-------------+
    |  retry  |<----| failed |---->| dead_letter |
    +---------+     +--------+     +-------------+
```

---

## 8. Error Handling

### 8.1 Error Categories

| Category | Handling | Recovery |
|----------|----------|----------|
| Gemini API timeout | Retry with exponential backoff | Auto-retry up to 3 times |
| Gemini 503/429 | Switch to alternate model | Fallback through model priority |
| Token limit exceeded | Subdivide chunk | auto-restart-failed-chunks |
| Gemini file expired | Mark as abandoned | Re-upload required (manual) |
| Lock timeout | Release and retry | release_expired_locks RPC |
| Worker crash | Detect via heartbeat | health-check-worker dispatch |

### 8.2 Error Notification Flow

```
Error Occurs
     |
     v
[complex_analysis_errors] - Record error details
     |
     v
send-admin-complex-analysis-error - Email notification
     |
     v
Admin Dashboard - View and resolve
```

### 8.3 Dead Letter Queue

Items reach dead letter queue when:
- `attempt_number >= max_attempts` (default: 3)
- All model fallbacks exhausted
- Unrecoverable errors (e.g., file expired)

Manual intervention options:
1. Reset to `pending` for retry
2. Delete and re-process
3. Mark processo as `error`

---

## 9. Performance Considerations

### 9.1 Concurrency Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `max_concurrent_workers` | 5 | Workers per processo |
| `lock_duration_minutes` | 15 | Lock timeout |
| `heartbeat_interval` | 30s | Worker heartbeat |
| `timeout_seconds` | 900 | Queue item timeout |

### 9.2 Bottlenecks and Mitigations

| Bottleneck | Mitigation |
|------------|------------|
| Gemini API rate limits | Model fallback, exponential backoff |
| Large PDF processing | Chunk size optimization |
| Database locks | SKIP LOCKED for queue acquisition |
| Memory usage | Streaming PDF processing |

### 9.3 Monitoring Metrics

Key metrics to monitor:
- `processing_queue` items by status
- `complex_processing_status.last_heartbeat` age
- `process_chunks` with stale `gemini_file_expires_at`
- Dead letter queue size
- Average processing time per chunk

### 9.4 Scaling Recommendations

For high volume:
1. Increase `max_concurrent_workers` (up to 10)
2. Deploy multiple instances of edge functions
3. Consider dedicated Gemini API quota
4. Implement rate limiting on upload

---

## Appendix A: Quick Reference

### Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `split-pdf-chunks` | Upload | Split PDF into chunks |
| `start-analysis-complex` | User action | Initialize analysis |
| `upload-chunks-worker` | Internal | Upload to Gemini |
| `process-complex-worker` | Internal | Process chunks |
| `consolidation-worker` | Internal | Consolidate results |
| `health-check-worker` | Cron (5min) | Health monitoring |
| `recover-stuck-chunks` | Cron (5min) | Chunk recovery |
| `recover-stuck-processes` | Cron (10min) | Process recovery |
| `detect-stuck-initializing` | Cron (5min) | Init phase recovery |
| `auto-restart-failed-chunks` | Cron (3min) | Token limit handling |

### Database Tables

| Table | Purpose |
|-------|---------|
| `processos` | Main process records |
| `process_chunks` | PDF chunks |
| `processing_queue` | Work queue |
| `complex_processing_status` | Progress tracking |
| `analysis_results` | Final results |
| `complex_analysis_errors` | Error logging |

### Key RPCs

| RPC | Purpose |
|-----|---------|
| `acquire_next_queue_item` | Get work item |
| `complete_queue_item` | Mark complete |
| `fail_queue_item` | Mark failed |
| `release_expired_locks` | Clean locks |
| `validate_chunks_integrity` | Validate chunks |
| `can_spawn_worker` | Check concurrency |
| `register_worker` | Add worker |
| `unregister_worker` | Remove worker |

---

*Document Version: 1.0*
*Last Updated: 2026-02-16*
