/*
  # Create admin_system_models table

  1. New Tables
    - `admin_system_models`
      - `id` (uuid, primary key) - Unique identifier for each model configuration
      - `project_id` (text, not null) - Google Cloud Project ID (e.g., 'arpj-473315')
      - `location` (text, not null) - Vertex AI location (e.g., 'us-central1')
      - `model_id` (text, not null) - Model identifier (e.g., 'gemini-2.0-flash-exp')
      - `is_active` (boolean, default false) - Indicates if this model is currently active
      - `created_at` (timestamptz, default now()) - Timestamp when model was registered
      - `updated_at` (timestamptz, default now()) - Timestamp of last update

  2. Security
    - Enable RLS on `admin_system_models` table
    - Add policy for authenticated users to read models
    - Add policy for authenticated users to insert new models
    - Add policy for authenticated users to update models

  3. Initial Data
    - Insert current production model configuration as the active model

  4. Constraints
    - Unique constraint on (project_id, location, model_id) to prevent duplicates
    - Check constraint to ensure only one model is active at a time using a partial unique index

  5. Important Notes
    - The active model configuration will be used by the analyze-transcription edge function
    - Only one model can be active at a time
    - Changes to the active model will trigger an automatic edge function deployment
*/

-- Create the admin_system_models table
CREATE TABLE IF NOT EXISTS admin_system_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  location text NOT NULL,
  model_id text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_model_config UNIQUE (project_id, location, model_id)
);

-- Create a partial unique index to ensure only one active model
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_model 
  ON admin_system_models (is_active) 
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE admin_system_models ENABLE ROW LEVEL SECURITY;

-- Policies for admin_system_models
CREATE POLICY "Authenticated users can read models"
  ON admin_system_models
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert models"
  ON admin_system_models
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update models"
  ON admin_system_models
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete models"
  ON admin_system_models
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert initial production model configuration
INSERT INTO admin_system_models (project_id, location, model_id, is_active)
VALUES ('arpj-473315', 'us-central1', 'gemini-2.0-flash-exp', true)
ON CONFLICT (project_id, location, model_id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_system_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_admin_system_models_updated_at_trigger ON admin_system_models;
CREATE TRIGGER update_admin_system_models_updated_at_trigger
  BEFORE UPDATE ON admin_system_models
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_system_models_updated_at();