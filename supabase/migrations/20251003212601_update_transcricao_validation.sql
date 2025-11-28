/*
  # Update transcricao validation to allow simple structure
  
  1. Changes
    - Modify validate_transcricao_structure function to accept simple structure with just totalPages
    - The detailed page data is now stored in the paginas table
    - The transcricao field only stores metadata
*/

CREATE OR REPLACE FUNCTION public.validate_transcricao_structure()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.transcricao IS NOT NULL THEN
    -- Transcricao can be either:
    -- 1. Simple format: { "totalPages": number }
    -- 2. Complex format (legacy): { "pages": [...], "totalPages": number }
    
    -- If it has pages array, validate it
    IF NEW.transcricao ? 'pages' THEN
      -- Pages must be array
      IF jsonb_typeof(NEW.transcricao->'pages') != 'array' THEN
        RAISE EXCEPTION 'Pages must be an array';
      END IF;
      
      -- Validate each page structure if array is not empty
      IF jsonb_array_length(NEW.transcricao->'pages') > 0 THEN
        IF EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(NEW.transcricao->'pages') AS page
          WHERE NOT (page ? 'pageNumber' AND page ? 'text')
        ) THEN
          RAISE EXCEPTION 'Each page must have pageNumber and text fields';
        END IF;
      END IF;
    END IF;
    
    -- If it's simple format, just check totalPages exists
    IF NOT (NEW.transcricao ? 'totalPages') THEN
      RAISE EXCEPTION 'Transcricao must contain totalPages field';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
