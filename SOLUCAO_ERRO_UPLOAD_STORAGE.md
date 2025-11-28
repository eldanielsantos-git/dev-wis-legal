# 🔧 Solução: Erro "new row violates row-level security policy"

## 🎯 Problema Identificado

**Erro:** `Falha no upload: new row violates row-level security policy`

**Causa:** O bucket de storage `processos` não tem policies de RLS configuradas, impedindo que usuários façam upload de arquivos.

**Processo afetado:** `4b0a567e-1c49-40a0-9d4f-75df9ac5bc95`

---

## ✅ SOLUÇÃO RÁPIDA (5 minutos)

### **Passo 1: Acesse o SQL Editor do Supabase**

1. Vá para: [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral esquerdo, clique em **SQL Editor**
4. Clique em **New query** (botão verde no canto superior direito)

---

### **Passo 2: Execute o Script de Correção**

1. **Copie TODO o conteúdo** do arquivo `FIX_STORAGE_BUCKET_RLS.sql` (está na raiz do projeto)

2. **Cole no editor SQL** que você abriu

3. **Clique em RUN** (botão verde no canto inferior direito)

4. **Aguarde** a mensagem: `Success. No rows returned`

5. **Verifique** se apareceu a lista de policies criadas no final

---

### **Passo 3: Teste o Upload**

1. Vá para o site
2. Tente fazer upload de um arquivo novamente
3. ✅ **Deve funcionar!**

---

## 📋 O Que o Script Faz

O script cria 5 policies de RLS para o bucket `processos`:

### **1. Allow authenticated users to upload files**
- Permite usuários autenticados fazerem upload
- Cada usuário só pode fazer upload para sua própria pasta (`user_id/arquivo.pdf`)

### **2. Allow users to read own files**
- Permite usuários lerem seus próprios arquivos
- Não podem ver arquivos de outros usuários

### **3. Allow users to update own files**
- Permite usuários atualizarem seus próprios arquivos

### **4. Allow users to delete own files**
- Permite usuários deletarem seus próprios arquivos

### **5. Allow admins to manage all files**
- Permite admins gerenciarem TODOS os arquivos
- Admins podem ver, editar e deletar qualquer arquivo

---

## 🔍 Como Funciona a Segurança

O sistema organiza arquivos assim:

```
bucket: processos/
├── [user_id_1]/
│   ├── 1234567890-arquivo1.pdf
│   └── 1234567891-arquivo2.pdf
├── [user_id_2]/
│   ├── 1234567892-documento.pdf
│   └── 1234567893-contrato.pdf
```

**Cada usuário:**
- ✅ Pode acessar APENAS arquivos em sua pasta (`user_id`)
- ❌ NÃO pode acessar arquivos de outros usuários
- ✅ Admins podem acessar tudo

---

## 🚨 Se o Erro Persistir

Se após executar o script o erro continuar:

### **1. Verifique se as policies foram criadas:**

Execute no SQL Editor:

```sql
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%files%'
ORDER BY policyname;
```

**Você deve ver 5 policies listadas:**
- Allow admins to manage all files
- Allow authenticated users to upload files
- Allow users to delete own files
- Allow users to read own files
- Allow users to update own files

---

### **2. Verifique se o bucket existe:**

```sql
SELECT * FROM storage.buckets WHERE name = 'processos';
```

**Deve retornar:**
- id: `processos`
- public: `false` (importante!)
- created_at: data de criação

---

### **3. Teste manualmente no Storage:**

1. No Supabase Dashboard, vá em **Storage**
2. Clique no bucket `processos`
3. Tente fazer upload manual de um arquivo
4. Se funcionar aqui mas não no site → problema no código frontend
5. Se não funcionar aqui → problema nas policies

---

## 🔐 Segurança Garantida

As policies criadas são SEGURAS porque:

1. **Isolamento por usuário**
   - Cada usuário só acessa sua pasta
   - Path validation: `(storage.foldername(name))[1] = auth.uid()::text`

2. **Autenticação obrigatória**
   - Apenas usuários logados podem fazer upload
   - Policy: `TO authenticated`

3. **Admins têm controle total**
   - Podem gerenciar todos os arquivos
   - Útil para suporte e moderação

4. **Não é público**
   - Bucket configurado como `public: false`
   - Arquivos não são acessíveis sem autenticação

---

## 📊 Estrutura de Pastas

O código já organiza corretamente:

```typescript
// Em ProcessosService.ts linha 58
const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
```

Resultado:
```
processos/
└── 45ef022b-5963-42b9-9bc3-936a1d3de22a/
    └── 1732742400000-documento.pdf
```

A policy valida:
```sql
(storage.foldername(name))[1] = auth.uid()::text
-- Extrai: "45ef022b-5963-42b9-9bc3-936a1d3de22a"
-- Compara com: auth.uid()
-- ✅ Se igual: permite
-- ❌ Se diferente: bloqueia
```

---

## ✅ Checklist de Resolução

- [ ] Executar script `FIX_STORAGE_BUCKET_RLS.sql` no SQL Editor
- [ ] Verificar "Success. No rows returned"
- [ ] Ver lista de 5 policies criadas
- [ ] Testar upload de arquivo no site
- [ ] Upload funciona sem erro ✅
- [ ] Arquivo aparece na lista de processos ✅

---

## 🎯 Resumo

**O que estava errado:**
- Bucket `processos` sem policies de RLS
- Qualquer tentativa de upload era bloqueada

**O que foi corrigido:**
- Criadas 5 policies de RLS
- Usuários podem fazer upload para suas pastas
- Admins têm acesso total
- Segurança mantida (isolamento por usuário)

**Próximo passo:**
- Execute o script SQL
- Teste o upload
- ✅ Pronto!

---

## 📞 Se Precisar de Ajuda

Se após executar o script ainda houver problemas:

1. **Tire print da tela do SQL Editor** mostrando o resultado
2. **Tire print do console do browser** (F12) mostrando o erro
3. **Me envie** o ID do processo que deu erro
4. **Verifique** se você está logado como usuário autenticado

---

**A solução é executar o script SQL no Supabase Dashboard!** 🚀
