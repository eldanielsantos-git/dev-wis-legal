/*
# Add append_to_transcription function

1. Database Functions
   - `append_to_transcription()` - Safely append pages to transcricao JSONB

2. Purpose  
   - Allow edge functions to add transcribed pages incrementally
   - Handle JSONB array concatenation safely
   - Maintain transcricao structure consistency
*/

CREATE OR REPLACE FUNCTION append_to_transcription(
    processo_id uuid,
    new_pages jsonb
)
RETURNS void AS $$
DECLARE
    parsed_pages jsonb;
    current_transcricao jsonb;
BEGIN
    -- Parse new_pages if it's a string
    IF jsonb_typeof(new_pages) = 'string' THEN
        parsed_pages := new_pages::text::jsonb;
    ELSE 
        parsed_pages := new_pages;
    END IF;
    
    -- Get current transcricao
    SELECT transcricao INTO current_transcricao 
    FROM processos 
    WHERE id = processo_id;
    
    -- Initialize transcricao if null
    IF current_transcricao IS NULL THEN
        current_transcricao := jsonb_build_object('pages', '[]'::jsonb, 'totalPages', 0);
    END IF;
    
    -- Ensure pages array exists
    IF NOT (current_transcricao ? 'pages') THEN
        current_transcricao := current_transcricao || jsonb_build_object('pages', '[]'::jsonb);
    END IF;
    
    -- Append new pages to existing pages array
    UPDATE processos 
    SET transcricao = current_transcricao || jsonb_build_object(
        'pages', 
        (current_transcricao->'pages') || parsed_pages
    )
    WHERE id = processo_id;
    
END;
$$ LANGUAGE plpgsql;