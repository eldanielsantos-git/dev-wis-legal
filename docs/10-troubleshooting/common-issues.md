# Problemas Comuns

Lista de problemas comuns e soluções.

## 1. Análise Não Inicia

**Sintomas:**
- Processo fica em "pending"
- Nenhum chunk criado
- Sem progresso

**Causas Possíveis:**
1. Saldo de tokens insuficiente
2. PDF corrompido
3. Edge Function não disparada

**Soluções:**

```bash
# 1. Verificar saldo de tokens
SELECT * FROM token_balance WHERE user_id = 'xxx';

# 2. Verificar status do processo
SELECT * FROM processos WHERE id = 'xxx';

# 3. Verificar logs da function
supabase functions logs start-analysis --tail

# 4. Manualmente trigger analysis
# Via Edge Function ou admin panel
```

## 2. Análise Travada

**Sintomas:**
- Processo em "processing" por muito tempo (> 30min)
- Progress não avança
- Alguns chunks em "processing"

**Causas Possíveis:**
1. Worker parado
2. Chunk em deadlock
3. Rate limit do Gemini

**Soluções:**

```sql
-- Ver chunks travados
SELECT * FROM chunks
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '10 minutes';

-- Resetar chunks
UPDATE chunks
SET status = 'pending', retry_count = retry_count + 1
WHERE id = 'xxx';

-- Ou usar função de recovery
```

```bash
# Trigger recovery function
supabase functions invoke recover-stuck-processes
```

## 3. Erro de Autenticação

**Sintomas:**
- "Invalid token" ou "Unauthorized"
- Redirecionado para login
- 401 errors nas requests

**Causas Possíveis:**
1. Token expirado
2. Sessão invalidada
3. RLS policy bloqueando

**Soluções:**

```typescript
// Limpar e fazer login novamente
await supabase.auth.signOut();
localStorage.clear();
// Login novamente
```

```sql
-- Verificar RLS policies
SELECT * FROM processos WHERE id = 'xxx';
-- Se vazio, verificar policies
```

## 4. Stripe Webhook Failed

**Sintomas:**
- Assinatura não ativa após pagamento
- Tokens não creditados
- Erro no Stripe Dashboard

**Causas Possíveis:**
1. Webhook signature inválida
2. Edge Function com erro
3. Dados não sincronizados

**Soluções:**

```bash
# 1. Verificar logs do webhook
supabase functions logs stripe-webhook

# 2. Reprocessar evento manualmente via Stripe Dashboard
# Dashboard → Webhooks → Event → Resend

# 3. Sincronizar manualmente
supabase functions invoke sync-stripe-subscription \
  --data '{"userId": "xxx"}'
```

## 5. Upload de PDF Falha

**Sintomas:**
- Erro ao fazer upload
- "Failed to upload file"
- Upload nunca completa

**Causas Possíveis:**
1. Arquivo muito grande (> 500MB)
2. PDF corrompido
3. Storage quota excedida

**Soluções:**

```typescript
// 1. Validar tamanho
if (file.size > 500 * 1024 * 1024) {
  throw new Error('File too large');
}

// 2. Validar tipo
if (file.type !== 'application/pdf') {
  throw new Error('Invalid file type');
}

// 3. Verificar quota no Supabase Dashboard
```

## 6. Chat Não Responde

**Sintomas:**
- Mensagem enviada mas sem resposta
- Loading infinito
- Erro na chamada

**Causas Possíveis:**
1. Análise não concluída
2. Sem tokens
3. Erro no Gemini

**Soluções:**

```typescript
// 1. Verificar se análise completou
const { data } = await supabase
  .from('processos')
  .select('status')
  .eq('id', processoId)
  .single();

if (data.status !== 'completed') {
  alert('Aguarde análise completar');
}

// 2. Verificar saldo de tokens
const { data: balance } = await supabase
  .from('token_balance')
  .select('available_tokens')
  .eq('user_id', userId)
  .single();
```

## 7. Processo Deletado Mas Arquivos Permanecem

**Sintomas:**
- Processo deletado do banco
- PDF ainda no storage
- Ocupando espaço

**Soluções:**

```typescript
// Deletar processo + arquivos
async function deleteProcessoComplete(processoId: string) {
  // 1. Get processo
  const { data: processo } = await supabase
    .from('processos')
    .select('pdf_path')
    .eq('id', processoId)
    .single();

  // 2. Delete from storage
  await supabase.storage
    .from('processos')
    .remove([processo.pdf_path]);

  // 3. Delete from database (cascade deletes related data)
  await supabase
    .from('processos')
    .delete()
    .eq('id', processoId);
}
```

## 8. Erro: "Insufficient Tokens"

**Sintomas:**
- Não consegue iniciar análise
- Mensagem de tokens insuficientes
- Balance mostra tokens mas não permite usar

**Causas Possíveis:**
1. Tokens reservados por análise anterior
2. Dados inconsistentes
3. Race condition

**Soluções:**

```sql
-- Verificar balance
SELECT
  available_tokens,
  reserved_tokens,
  available_tokens - reserved_tokens as usable
FROM token_balance
WHERE user_id = 'xxx';

-- Verificar reservas ativas
SELECT * FROM token_reservations
WHERE user_id = 'xxx' AND status = 'active';

-- Se houver reserva órfã (sem processo), limpar
UPDATE token_reservations
SET status = 'cancelled'
WHERE id = 'xxx';

-- Recalcular balance
UPDATE token_balance
SET reserved_tokens = (
  SELECT COALESCE(SUM(reserved_amount), 0)
  FROM token_reservations
  WHERE user_id = token_balance.user_id
  AND status = 'active'
)
WHERE user_id = 'xxx';
```

## 9. Dark Mode Não Salva

**Sintomas:**
- Alterna dark mode
- Recarrega página e volta para light

**Causas Possíveis:**
1. Preferência não salva no banco
2. Context não persistindo
3. localStorage não funcionando

**Soluções:**

```typescript
// Salvar preferência
async function saveThemePreference(theme: 'light' | 'dark') {
  // 1. Save to database
  await supabase
    .from('user_preferences')
    .update({ theme })
    .eq('user_id', userId);

  // 2. Save to localStorage (fallback)
  localStorage.setItem('theme', theme);
}
```

## 10. Análise Retorna JSON Inválido

**Sintomas:**
- Erro "Invalid JSON"
- Análise falha na consolidação
- Resultado truncado

**Causas Possíveis:**
1. Gemini retornou texto não-JSON
2. Resposta muito grande e foi truncada
3. Caracteres especiais não escapados

**Soluções:**

```typescript
// Validar e sanitizar resposta
function sanitizeGeminiResponse(text: string): object {
  try {
    // Remove markdown code blocks if present
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Parse JSON
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!isValidAnalysisResult(parsed)) {
      throw new Error('Invalid structure');
    }

    return parsed;
  } catch (error) {
    logger.error('Failed to parse Gemini response', { text, error });
    throw new Error('Invalid JSON response from AI');
  }
}
```

---

## Comandos Úteis de Debug

```bash
# Ver todos os processos travados
supabase sql "SELECT * FROM processos WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '30 minutes'"

# Ver chunks em dead letter
supabase sql "SELECT * FROM chunks WHERE dead_letter_at IS NOT NULL"

# Ver últimas transações de um usuário
supabase sql "SELECT * FROM token_transactions WHERE user_id = 'xxx' ORDER BY created_at DESC LIMIT 10"

# Verificar health do sistema
supabase functions invoke health-check-worker
```

---

## Quando Contactar Suporte

Se após tentar as soluções acima o problema persistir:

1. Colete informações:
   - Logs relevantes
   - IDs (processo, chunk, user)
   - Timestamp do erro
   - Passos para reproduzir

2. Abra issue no GitHub com template de bug report

3. Para problemas críticos de produção: email para suporte@seudominio.com

---

[← Voltar ao Troubleshooting](./README.md)
