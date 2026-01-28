/*
  # Recompile log_completed_process_to_history function
  
  This migration forces a recompile of the trigger function to clear
  any potential cached plans that might reference old column names.
  
  The function logs completed processes to the process_history audit table.
*/

CREATE OR REPLACE FUNCTION log_completed_process_to_history()
RETURNS TRIGGER AS $$
DECLARE
  v_user_first_name text;
  v_user_last_name text;
  v_user_email text;
  v_llm_tokens_total bigint;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT first_name, last_name, email
    INTO v_user_first_name, v_user_last_name, v_user_email
    FROM user_profiles
    WHERE id = NEW.user_id;

    SELECT COALESCE(SUM(tokens_used), 0)
    INTO v_llm_tokens_total
    FROM analysis_results
    WHERE processo_id = NEW.id;

    INSERT INTO process_history (
      process_id,
      user_id,
      user_first_name,
      user_last_name,
      user_email,
      file_name,
      total_pages,
      llm_model_name,
      llm_tokens_used,
      processed_at
    ) VALUES (
      NEW.id::text,
      NEW.user_id::text,
      v_user_first_name,
      v_user_last_name,
      v_user_email,
      NEW.file_name,
      COALESCE(NEW.total_pages, 0),
      NEW.current_llm_model_name,
      v_llm_tokens_total,
      COALESCE(NEW.analysis_completed_at, now())
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;