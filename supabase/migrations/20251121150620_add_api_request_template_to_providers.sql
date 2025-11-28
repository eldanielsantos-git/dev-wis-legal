/*
  # Add API Request Template to LLM Providers

  1. Changes
    - Add `api_request_template` column to `llm_api_providers` table
    - This stores the JSON template for API requests specific to each provider
    - Allows customization of request format for different LLM providers

  2. Details
    - Type: JSONB for flexible storage of request templates
    - Nullable: Yes (optional field)
    - Default: NULL

  3. Example Templates
    - Google Gemini: Different format than OpenAI
    - OpenAI: Standard chat completions format
    - Anthropic: Messages API format
    - Custom providers: Can define their own format
*/

-- Add api_request_template column
ALTER TABLE llm_api_providers
ADD COLUMN IF NOT EXISTS api_request_template JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN llm_api_providers.api_request_template IS 'JSON template for API requests. Defines the structure and format required by this specific LLM provider.';

-- Create index for JSONB queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_llm_api_providers_template
ON llm_api_providers USING gin (api_request_template);

-- Example: Update existing Google Gemini provider with template (if exists)
UPDATE llm_api_providers
SET api_request_template = '{
  "contents": [
    {
      "parts": [
        {
          "text": "{{prompt}}"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 8192
  }
}'::jsonb
WHERE provider_type = 'google-gemini'
AND api_request_template IS NULL;

-- Example: Update existing OpenAI providers with template (if exists)
UPDATE llm_api_providers
SET api_request_template = '{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "{{prompt}}"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 8192
}'::jsonb
WHERE provider_type = 'openai'
AND api_request_template IS NULL;

-- Example: Update existing Anthropic providers with template (if exists)
UPDATE llm_api_providers
SET api_request_template = '{
  "model": "claude-3-opus-20240229",
  "messages": [
    {
      "role": "user",
      "content": "{{prompt}}"
    }
  ],
  "max_tokens": 4096,
  "temperature": 0.7
}'::jsonb
WHERE provider_type = 'anthropic'
AND api_request_template IS NULL;
