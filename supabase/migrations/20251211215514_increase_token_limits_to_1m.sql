/*
  # Increase Token Limits to 1 Million

  1. Changes
    - Update max_allowed from 60000/100000 to 1000000 for all contexts
    - This allows administrators to configure token limits up to 1 million tokens
    - Gemini 2.0 Flash supports up to 8192 output tokens
    - Gemini 1.5 Pro supports up to 8192 output tokens  
    - Gemini 2.0 Flash Thinking (experimental) supports up to 65536 output tokens
    
  2. Impact
    - Administrators can now set higher token limits for better response quality
    - No change to current configured values, only the maximum allowed limit
*/

-- Update all token limit configurations to allow up to 1 million tokens
UPDATE token_limits_config 
SET max_allowed = 1000000
WHERE max_allowed < 1000000;
