@@ .. @@
   IN jsonb
   DEFAULT '{}'
 );
+
+-- Function to get next batch processing item (for docai-batch-monitor)
+CREATE OR REPLACE FUNCTION get_next_batch_processing_item()
+RETURNS TABLE (
+  id uuid,
+  gcs_operation_name text,
+  file_name text
+) AS $$
+BEGIN
+  RETURN QUERY
+  SELECT 
+    p.id,
+    p.gcs_operation_name,
+    p.file_name
+  FROM processos p
+  WHERE p.status = 'processing_batch'
+    AND p.gcs_operation_name IS NOT NULL
+  ORDER BY p.created_at ASC
+  LIMIT 1;
+END;
+$$ LANGUAGE plpgsql;
+
+-- Function to log transcription events (for audit trail)
+CREATE OR REPLACE FUNCTION log_transcription_event(
+  processo_uuid uuid,
+  event_action text,
+  event_details jsonb DEFAULT '{}'
+)
+RETURNS void AS $$
+BEGIN
+  INSERT INTO transcription_logs (processo_id, action, details)
+  VALUES (processo_uuid, event_action, event_details);
+END;
+$$ LANGUAGE plpgsql;