# 🚀 Deploy Urgente: process-next-prompt com Validação de Tokens

## ⚠️ **PROBLEMA CRÍTICO**

A edge function `process-next-prompt` em **PRODUÇÃO** NÃO possui as validações de token limit, causando:
- ❌ Chunks de 600 páginas (900k tokens) sendo enviados para Gemini
- ❌ 100% de falha com erro: `The input token count exceeds the maximum number of tokens allowed 1048576`
- ❌ Loops infinitos tentando todos os modelos
- ❌ Processos travados indefinidamente

## ✅ **SOLUÇÃO IMPLEMENTADA NO CÓDIGO LOCAL**

O arquivo `supabase/functions/process-next-prompt/index.ts` **JÁ POSSUI**:

### **Validação 1: Processamento Individual de Chunks (linha 418-431)**
```typescript
// ⚠️ VALIDAÇÃO CRÍTICA: Token limit check ANTES de enviar para LLM
if (chunk.token_validation_status === 'exceeded') {
  const errorMsg = `Chunk ${chunk.chunk_index} excede limite: ${chunk.estimated_tokens} tokens (máx: 850k). SUBDIVIDIR NECESSÁRIO.`;
  console.error(`🚫 ${errorMsg}`);
  throw new Error(errorMsg);
}

if (!chunk.estimated_tokens || chunk.estimated_tokens > 850000) {
  const errorMsg = `Chunk ${chunk.chunk_index} sem validação de tokens ou excede limite. estimated_tokens: ${chunk.estimated_tokens}`;
  console.error(`❌ ${errorMsg}`);
  throw new Error(errorMsg);
}

console.log(`📄 Processando chunk ${chunk.chunk_index}/${chunks.length} (~${chunk.estimated_tokens.toLocaleString()} tokens - SAFE)...`);
```

### **Validação 2: Processamento Consolidado (linha 578-581)**
```typescript
// ⚠️ VALIDAÇÃO CRÍTICA: Token limit check
if (chunk.token_validation_status === 'exceeded' || (chunk.estimated_tokens && chunk.estimated_tokens > 850000)) {
  throw new Error(`Chunk ${chunk.chunk_index} excede limite de tokens: ${chunk.estimated_tokens}. Subdividir necessário.`);
}
```

---

## 🚀 **DEPLOY MANUAL URGENTE**

### **Opção 1: Via Supabase CLI (Recomendado)**

```bash
# 1. Login no Supabase
supabase login

# 2. Link ao projeto
supabase link --project-ref <seu-project-ref>

# 3. Deploy da função
supabase functions deploy process-next-prompt

# 4. Verificar deploy
supabase functions list
```

### **Opção 2: Via Dashboard Supabase**

1. Acesse: https://supabase.com/dashboard/project/<seu-project>/functions
2. Clique em `process-next-prompt`
3. Clique em "Edit Function"
4. Copie o conteúdo completo de `supabase/functions/process-next-prompt/index.ts`
5. Cole e salve
6. Clique em "Deploy"

### **Opção 3: Via API do Supabase**

```bash
# Obter access token do dashboard
# https://supabase.com/dashboard/account/tokens

curl -X POST \
  "https://api.supabase.com/v1/projects/<project-ref>/functions/process-next-prompt/deploy" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  --data-binary @supabase/functions/process-next-prompt/index.ts
```

---

## 🔍 **VERIFICAÇÃO PÓS-DEPLOY**

### **1. Testar com Processo Existente**

```bash
# Disparar worker para chunk com token_validation_status = 'exceeded'
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/process-next-prompt" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Comportamento Esperado:**
```
🚫 Chunk 2 excede limite: 900000 tokens (máx: 850k). SUBDIVIDIR NECESSÁRIO.
```

### **2. Ver Logs em Tempo Real**

```bash
supabase functions logs process-next-prompt --follow
```

**Buscar por:**
- ✅ `VALIDAÇÃO CRÍTICA: Token limit check`
- ✅ `tokens - SAFE`
- ❌ NÃO deve aparecer: `The input token count exceeds`

---

## 📊 **IMPACTO DO DEPLOY**

### **Antes (Produção Atual):**
- ❌ Chunks de 600 páginas enviados diretamente
- ❌ 900.000 tokens → EXCEDE 1.048.576
- ❌ Todos os 4 modelos falham
- ❌ Processo trava indefinidamente

### **Depois (Com Validação):**
- ✅ Validação ANTES de enviar para LLM
- ✅ Chunks com `token_validation_status='exceeded'` são BLOQUEADOS
- ✅ Erro claro: "Chunk X excede limite: Y tokens. SUBDIVIDIR NECESSÁRIO"
- ✅ Sistema não desperdiça tentativas em chunks inválidos
- ✅ GitHub Actions pode detectar e subdividir automaticamente

---

## 🐛 **DEBUG: Processo Travado Atual**

### **Processo ID:** `1e0ae014-34cb-479d-9aae-365b4f1a816a`

**Chunks Problemáticos:**
```sql
SELECT chunk_index, pages_count, estimated_tokens, token_validation_status, status
FROM process_chunks
WHERE processo_id = '1e0ae014-34cb-479d-9aae-365b4f1a816a'
AND token_validation_status = 'exceeded';

-- Resultado:
-- Chunk 1: 600 páginas, 900k tokens, exceeded, completed ❌
-- Chunk 2: 600 páginas, 900k tokens, exceeded, ready ❌
-- Chunk 3: 600 páginas, 900k tokens, exceeded, ready ❌
-- Chunk 4: 600 páginas, 900k tokens, exceeded, completed ❌
-- Chunk 5: 600 páginas, 900k tokens, exceeded, completed ❌
-- Chunk 6: 600 páginas, 900k tokens, exceeded, completed ❌
```

**TODOS os chunks com 600 páginas EXCEDEM o limite!**

### **Correção Temporária (Até Deploy):**

```sql
-- Marcar processo como failed para parar tentativas
UPDATE processos
SET status = 'failed'
WHERE id = '1e0ae014-34cb-479d-9aae-365b4f1a816a';

-- Limpar fila de processamento
DELETE FROM processing_queue
WHERE processo_id = '1e0ae014-34cb-479d-9aae-365b4f1a816a';
```

---

## ✅ **CHECKLIST DE DEPLOY**

- [ ] Fazer backup do código atual em produção
- [ ] Deploy da nova versão com validações
- [ ] Verificar logs para confirmar validações ativas
- [ ] Testar com processo novo (3.710 páginas)
- [ ] Confirmar que chunks > 850k tokens são bloqueados
- [ ] Monitorar próximos uploads de arquivos grandes

---

## 📝 **NOTAS IMPORTANTES**

1. **Este deploy é CRÍTICO** - Sistema não funciona para arquivos >1000 páginas sem ele
2. **Validação já está no código local** - Apenas precisa ser deployada
3. **Trigger de validação JÁ FUNCIONA** - chunks têm `token_validation_status` correto
4. **Frontend ainda usa chunk size antigo** - Próximos uploads também criarão chunks de 600 páginas
5. **Após este deploy, próxima correção:** Deploy do frontend com chunk sizes corretos (400/300/200)

---

## 🚨 **URGÊNCIA: ALTA**

**Motivo:** Todos os arquivos grandes (>1000 páginas) estão falhando 100% sem esta validação.

**Tempo estimado:** 5 minutos para deploy + 2 minutos para verificação = **7 minutos total**

---

## 📞 **SUPORTE**

Se houver problemas no deploy:
1. Verificar access token está válido
2. Confirmar project-ref correto
3. Ver logs: `supabase functions logs process-next-prompt`
4. Rollback: deployar versão anterior se necessário
