/*
  # Fix validate_transcricao_structure function
  
  1. Changes
    - Fix PERFORM query to use proper alias for jsonb_array_elements
    - Correct the logic to properly validate page structure
*/

CREATE OR REPLACE FUNCTION public.validate_transcricao_structure()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.transcricao IS NOT NULL THEN
    -- Must have pages array
    IF NOT (NEW.transcricao ? 'pages') THEN
      RAISE EXCEPTION 'Transcricao must contain pages array';
    END IF;
    
    -- Pages must be array
    IF jsonb_typeof(NEW.transcricao->'pages') != 'array' THEN
      RAISE EXCEPTION 'Pages must be an array';
    END IF;
    
    -- Validate each page structure
    IF jsonb_array_length(NEW.transcricao->'pages') > 0 THEN
      -- Check if any page is missing required fields
      IF EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(NEW.transcricao->'pages') AS page
        WHERE NOT (page ? 'pageNumber' AND page ? 'text')
      ) THEN
        RAISE EXCEPTION 'Each page must have pageNumber and text fields';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
