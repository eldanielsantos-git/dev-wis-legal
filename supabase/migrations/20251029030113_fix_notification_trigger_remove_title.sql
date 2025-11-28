/*
  # Fix notification trigger to remove title column

  1. Changes
    - Update trigger function to not use 'title' column (doesn't exist)
    - Use only 'message' column as defined in notifications table

  2. Notes
    - The notifications table only has: user_id, processo_id, type, message, is_read
    - Previous trigger was trying to use non-existent 'title' column
*/

CREATE OR REPLACE FUNCTION create_notification_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'completed' THEN
      INSERT INTO notifications (user_id, message, type, processo_id, is_read)
      VALUES (
        NEW.user_id,
        'A análise do processo "' || NEW.file_name || '" foi concluída com sucesso.',
        'success',
        NEW.id,
        false
      );
    ELSIF NEW.status = 'error' THEN
      INSERT INTO notifications (user_id, message, type, processo_id, is_read)
      VALUES (
        NEW.user_id,
        'Ocorreu um erro na análise do processo "' || NEW.file_name || '".',
        'error',
        NEW.id,
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
