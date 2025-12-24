/*
  # Fix deadline expiration to consider date AND time
  
  1. Changes
    - Update `update_expired_deadlines()` function to consider both date and time
    - If deadline_time is NULL, assumes end of day (23:59:59)
    - Combines deadline_date + deadline_time into a single timestamp for accurate comparison
  
  2. Logic
    - Creates a timestamp by combining deadline_date with deadline_time (or 23:59:59 if NULL)
    - Compares this timestamp with the current moment (NOW())
    - Marks as 'expired' only if the combined datetime has truly passed
  
  3. Examples
    - Deadline: 2025-01-15 08:00 → expires on 2025-01-15 at 08:00:00
    - Deadline: 2025-01-15 (no time) → expires on 2025-01-15 at 23:59:59
*/

CREATE OR REPLACE FUNCTION update_expired_deadlines()
RETURNS void AS $$
BEGIN
  UPDATE process_deadlines
  SET status = 'expired'
  WHERE status = 'pending'
    AND (
      -- Combine date + time (or end of day if no time specified)
      deadline_date::timestamp + COALESCE(deadline_time, '23:59:59'::time)
    ) < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;