/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  FIX STORAGE BUCKET RLS POLICIES FOR 'processos'                        ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  PROBLEMA:
  Usuários não conseguem fazer upload de arquivos para o bucket 'processos'
  Erro: "new row violates row-level security policy"

  SOLUÇÃO:
  Criar policies de RLS para permitir que usuários autenticados façam upload
  de arquivos para suas próprias pastas.

  INSTRUÇÕES:
  1. Vá para: https://supabase.com/dashboard/project/[seu-projeto]/sql
  2. Cole este script completo
  3. Clique em "RUN" (canto inferior direito)
  4. Aguarde a confirmação "Success. No rows returned"
  5. Teste fazendo upload de um arquivo novamente

  ═══════════════════════════════════════════════════════════════════════════
*/

-- Drop existing policies if they exist (para ser idempotente)
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to manage all files" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. POLICY: Permitir usuários autenticados fazerem UPLOAD (INSERT)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. POLICY: Permitir usuários lerem seus próprios arquivos (SELECT)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Allow users to read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. POLICY: Permitir usuários atualizarem seus próprios arquivos (UPDATE)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Allow users to update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. POLICY: Permitir usuários deletarem seus próprios arquivos (DELETE)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Allow users to delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. POLICY: Permitir ADMINS gerenciarem TODOS os arquivos (ALL)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Allow admins to manage all files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'processos'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
)
WITH CHECK (
  bucket_id = 'processos'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: Listar policies criadas
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%files%'
ORDER BY policyname;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ PRONTO! Agora os usuários podem fazer upload de arquivos.
-- ═══════════════════════════════════════════════════════════════════════════
