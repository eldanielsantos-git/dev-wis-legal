/*
  # Add prompt_content to analysis_results

  1. Changes
    - Add `prompt_content` column to `analysis_results` table
    - This stores the prompt text so we can process it without re-querying
*/

ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS prompt_content text;
