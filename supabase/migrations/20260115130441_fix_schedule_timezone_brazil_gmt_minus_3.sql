/*
  # Fix Schedule Timezone - Brazil GMT-3
  
  1. Problem
    - Deadlines were being marked as expired 3 hours earlier than expected
    - Database was treating deadline times as UTC instead of Brazil time (GMT-3)
    - User enters "12:06" expecting Brazil time, but system compared as if it were UTC
  
  2. Solution
    - Update `update_expired_deadlines()` function to interpret deadline times as Brazil timezone
    - Convert Brazil time to UTC for proper comparison with NOW()
    - Ensures deadlines expire at the correct local time for users in São Paulo/Brasília
  
  3. How it works
    - User creates deadline: "2026-01-15 12:06" (thinking Brazil time)
    - System saves: deadline_date='2026-01-15', deadline_time='12:06:00'
    - Function interprets as: "2026-01-15 12:06:00 America/Sao_Paulo"
    - Converts to UTC: "2026-01-15 15:06:00 UTC" (adds 3 hours)
    - Compares with NOW() in UTC
    - Only expires after 12:06 PM Brazil time (not 9:06 AM as before)
  
  4. Timezone
    - Uses 'America/Sao_Paulo' which correctly handles GMT-3
    - PostgreSQL automatically handles any future timezone changes
*/

CREATE OR REPLACE FUNCTION update_expired_deadlines()
RETURNS void AS $$
BEGIN
  UPDATE process_deadlines
  SET status = 'expired'
  WHERE status = 'pending'
    AND (
      -- Interpret deadline_date + deadline_time as Brazil time, then convert to UTC
      timezone('UTC', 
        timezone('America/Sao_Paulo',
          (deadline_date::text || ' ' || COALESCE(deadline_time::text, '23:59:59'))::timestamp
        )
      )
    ) < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;