-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAR POLICIES PARA BUCKET PROCESSOS - VERSÃO SIMPLES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR:
-- https://supabase.com/dashboard → Seu Projeto → SQL Editor → New Query
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Remover policies existentes (se houver)
DROP POLICY IF EXISTS "Authenticated users can upload to processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICY 1: Permitir usuários autenticados fazerem UPLOAD (INSERT)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Authenticated users can upload to processos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'processos'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICY 2: Permitir usuários verem seus próprios arquivos (SELECT)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'processos'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAR SE AS POLICIES FORAM CRIADAS
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
ORDER BY policyname;

-- ═══════════════════════════════════════════════════════════════════════════
-- OPCIONAL: Tornar o bucket privado novamente (após criar as policies)
-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATE storage.buckets SET public = false WHERE name = 'processos';
