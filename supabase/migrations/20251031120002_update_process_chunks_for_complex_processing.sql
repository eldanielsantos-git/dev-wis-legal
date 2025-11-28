/*
  # Update process_chunks table for complex processing with context

  1. Changes to process_chunks table
    - Add overlap fields to handle chunk overlap for context preservation
    - Add context_summary to store summary for next chunk
    - Add processing_result to store detailed results
    - Add retry and error tracking fields
    - Add processing time metrics

  2. Purpose
    - Enable context preservation between chunks via overlap
    - Store intermediate results and summaries
    - Track processing performance and errors
    - Support retry logic with error history

  3. Notes
    - Overlap typically 50 pages between chunks
    - Context summary ~1500-2000 tokens max
    - Processing results stored as JSONB for flexibility
*/

-- Add new columns to process_chunks table
ALTER TABLE process_chunks
ADD COLUMN IF NOT EXISTS overlap_start_page int,
ADD COLUMN IF NOT EXISTS overlap_end_page int,
ADD COLUMN IF NOT EXISTS context_summary jsonb,
ADD COLUMN IF NOT EXISTS processing_result jsonb,
ADD COLUMN IF NOT EXISTS processing_time_seconds int,
ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS tokens_used int;

-- Add comments for documentation
COMMENT ON COLUMN process_chunks.overlap_start_page IS 'Start page of overlap region with previous chunk';
COMMENT ON COLUMN process_chunks.overlap_end_page IS 'End page of overlap region with previous chunk';
COMMENT ON COLUMN process_chunks.context_summary IS 'Executive summary of this chunk to pass to next chunk as context';
COMMENT ON COLUMN process_chunks.processing_result IS 'Detailed processing results for this chunk';
COMMENT ON COLUMN process_chunks.processing_time_seconds IS 'Time taken to process this chunk in seconds';
COMMENT ON COLUMN process_chunks.retry_count IS 'Number of retry attempts for this chunk';
COMMENT ON COLUMN process_chunks.last_error IS 'Last error message if processing failed';
COMMENT ON COLUMN process_chunks.tokens_used IS 'Number of tokens consumed processing this chunk';

-- Create index for context queries
CREATE INDEX IF NOT EXISTS idx_process_chunks_context
  ON process_chunks(processo_id, chunk_index)
  WHERE context_summary IS NOT NULL;

-- Create index for performance analysis
CREATE INDEX IF NOT EXISTS idx_process_chunks_performance
  ON process_chunks(processing_time_seconds)
  WHERE processing_time_seconds IS NOT NULL;

-- Create index for error tracking
CREATE INDEX IF NOT EXISTS idx_process_chunks_errors
  ON process_chunks(processo_id, retry_count)
  WHERE retry_count > 0;
