/*
  # Fix Deadline Timezone - Use AT TIME ZONE Operator
  
  1. Problem
    - Previous migration used timezone() function which has incorrect behavior
    - timezone(zone, timestamp) interprets timestamp as UTC and converts TO the zone
    - We need AT TIME ZONE which interprets timestamp AS being in the zone
  
  2. Solution
    - Replace timezone() function with AT TIME ZONE operator
    - timestamp AT TIME ZONE 'America/Sao_Paulo' interprets the time as Brazil time
    - Result is automatically in UTC (timestamptz), ready for comparison with NOW()
  
  3. Example
    - Input: deadline_date='2026-01-15', deadline_time='12:07:00'
    - Concatenated: '2026-01-15 12:07:00'::timestamp
    - AT TIME ZONE 'America/Sao_Paulo': '2026-01-15 15:07:00+00' (timestamptz in UTC)
    - NOW(): '2026-01-15 13:14:00+00' (current time in UTC)
    - Comparison: 15:07 < 13:14 = FALSE (correctly not expired)
  
  4. Testing
    - Tested with real data at 10:14 AM Brazil time
    - Deadline at 12:07 PM Brazil time correctly identified as not expired
*/

CREATE OR REPLACE FUNCTION update_expired_deadlines()
RETURNS void AS $$
BEGIN
  UPDATE process_deadlines
  SET status = 'expired'
  WHERE status = 'pending'
    AND (
      -- Interpret deadline as Brazil time using AT TIME ZONE
      -- This returns timestamptz in UTC, ready for comparison with NOW()
      ((deadline_date::text || ' ' || COALESCE(deadline_time::text, '23:59:59'))::timestamp 
        AT TIME ZONE 'America/Sao_Paulo') < NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;