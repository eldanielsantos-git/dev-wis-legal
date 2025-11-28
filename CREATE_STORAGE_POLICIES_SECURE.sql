-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAR POLICIES PARA BUCKET PROCESSOS - VERSÃO SEGURA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ESTA VERSÃO É MAIS SEGURA: usuários só podem fazer upload na sua própria pasta
--
-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR:
-- https://supabase.com/dashboard → Seu Projeto → SQL Editor → New Query
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Remover policies existentes (se houver)
DROP POLICY IF EXISTS "Authenticated users can upload to processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all files" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICY 1: Usuários podem fazer UPLOAD apenas na sua própria pasta
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Authenticated users can upload to processos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICY 2: Usuários podem VER apenas seus próprios arquivos
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICY 3: Usuários podem DELETAR apenas seus próprios arquivos
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'processos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICY 4: ADMINS podem gerenciar TODOS os arquivos
-- ═══════════════════════════════════════════════════════════════════════════
CREATE POLICY "Admins can manage all files"
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
-- TORNAR O BUCKET PRIVADO NOVAMENTE (após criar as policies)
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE storage.buckets SET public = false WHERE name = 'processos';

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ PRONTO! Agora o sistema está seguro:
-- - Usuários só acessam arquivos na pasta deles (user_id/)
-- - Admins podem gerenciar tudo
-- - Bucket privado (arquivos não são públicos)
-- ═══════════════════════════════════════════════════════════════════════════
