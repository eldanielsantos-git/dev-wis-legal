/*
  # Add analysis_pdf_url column to processos table

  1. Changes
    - Add `analysis_pdf_url` column (text, nullable) to store the URL of the generated analysis PDF
    - This allows tracking which processes have their analysis PDF generated and available

  2. Purpose
    - Enable quick access to the analysis PDF URL without needing to construct it
    - Useful for tracking PDF generation status
    - Facilitates future features like batch PDF generation tracking
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' 
    AND column_name = 'analysis_pdf_url'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE processos ADD COLUMN analysis_pdf_url text;
    COMMENT ON COLUMN processos.analysis_pdf_url IS 'URL of the generated analysis PDF stored in Supabase Storage';
  END IF;
END $$;