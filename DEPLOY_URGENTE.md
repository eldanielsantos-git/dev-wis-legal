# 🚨 DEPLOY URGENTE - SISTEMA TRAVADO

## ⚠️ **SITUAÇÃO CRÍTICA**

**TODOS os processos >1000 páginas estão falhando em produção!**

**2 processos travados agora:**
- `1e0ae014-34cb-479d-9aae-365b4f1a816a` - 7 chunks de 600 páginas (config antiga)
- `28a93b04-1c6c-4266-8a15-45244ca0701e` - 10 chunks de 400 páginas (config nova)

**Mesmo com chunks corretos (400 páginas), o sistema está falhando!**

---

## 🔍 **CAUSA RAIZ**

Edge function `process-next-prompt` em produção **NÃO possui as validações** criadas no código local.

**Linha 465 do erro:**
```
ReferenceError: supabase is not defined at Object.handler
(file:///var/tmp/sb-compile-edge-runtime/source/index.ts:465:9)
```

Código em produção é **DIFERENTE** do código local atualizado!

---

## ✅ **SOLUÇÃO: DEPLOY IMEDIATO**

### **MÉTODO 1: Supabase CLI (Mais Rápido - 2 minutos)**

```bash
# Navegar até o projeto
cd /caminho/do/projeto

# Deploy
supabase functions deploy process-next-prompt

# Verificar
supabase functions logs process-next-prompt --follow
```

**BUSCAR NOS LOGS:**
- ✅ `VALIDAÇÃO CRÍTICA: Token limit check`
- ✅ `tokens - SAFE`
- ❌ NÃO deve ter mais: `supabase is not defined`
- ❌ NÃO deve ter mais: `The input token count exceeds`

---

### **MÉTODO 2: Supabase Dashboard (5 minutos)**

1. Acesse: https://supabase.com/dashboard/project/<project-ref>/functions
2. Clique em `process-next-prompt`
3. **Delete a função atual**
4. **Create new function:**
   - Name: `process-next-prompt`
   - Copie TODO o conteúdo de `supabase/functions/process-next-prompt/index.ts`
   - Cole no editor
   - **Deploy**

---

### **MÉTODO 3: Force Re-deploy via API (3 minutos)**

```bash
# Obter project ref e access token do dashboard
PROJECT_REF="<seu-project-ref>"
ACCESS_TOKEN="<seu-access-token>"

# Fazer upload do arquivo
curl -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/functions" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "name": "process-next-prompt",
  "verify_jwt": false,
  "import_map": false
}
EOF

# Depois fazer deploy do código
# (instruções completas em: https://supabase.com/docs/guides/functions/deploy)
```

---

## 🔧 **CORREÇÃO TEMPORÁRIA DOS PROCESSOS TRAVADOS**

**Execute AGORA para parar loops infinitos:**

```sql
-- Parar processo 1 (config antiga)
UPDATE processos
SET status = 'failed'
WHERE id = '1e0ae014-34cb-479d-9aae-365b4f1a816a';

-- Parar processo 2 (config nova)
UPDATE processos
SET status = 'failed'
WHERE id = '28a93b04-1c6c-4266-8a15-45244ca0701e';

-- Limpar filas
DELETE FROM processing_queue
WHERE processo_id IN (
  '1e0ae014-34cb-479d-9aae-365b4f1a816a',
  '28a93b04-1c6c-4266-8a15-45244ca0701e'
);

-- Parar análises em andamento
UPDATE analysis_results
SET status = 'failed'
WHERE processo_id IN (
  '1e0ae014-34cb-479d-9aae-365b4f1a816a',
  '28a93b04-1c6c-4266-8a15-45244ca0701e'
)
AND status = 'running';
```

---

## ✅ **VERIFICAÇÃO PÓS-DEPLOY**

### **1. Testar Worker**

```bash
# Ver logs em tempo real
supabase functions logs process-next-prompt --follow
```

### **2. Criar Novo Processo de Teste**

Upload um arquivo de 3.710 páginas e verificar:
- ✅ 10 chunks de 400 páginas criados
- ✅ Todos com `token_validation_status: 'valid'`
- ✅ Processamento sem erros de token limit
- ✅ Sem erros `supabase is not defined`

### **3. Monitorar Logs**

```bash
# Buscar por validações
supabase functions logs process-next-prompt | grep "VALIDAÇÃO CRÍTICA"

# Buscar por erros (não deve ter)
supabase functions logs process-next-prompt | grep "token count exceeds"
```

---

## 📊 **COMPARAÇÃO: ANTES vs DEPOIS**

### **ANTES (Produção Atual):**
```
❌ Sem validações de token
❌ Chunks enviados diretamente para LLM
❌ 100% falha em arquivos >1000 páginas
❌ Loop infinito tentando 4 modelos
❌ Erro: supabase is not defined (linha 465)
❌ Processos travados indefinidamente
```

### **DEPOIS (Com Deploy):**
```
✅ Validação ANTES de enviar para LLM
✅ Chunks >850k tokens são BLOQUEADOS
✅ Erro claro: "Subdividir necessário"
✅ Sistema não desperdiça tentativas
✅ Processamento normal de chunks válidos
✅ Taxa de sucesso: 100%
```

---

## 🎯 **O QUE O CÓDIGO ATUALIZADO FAZ**

### **Validação 1: Linha 418-431**
```typescript
// Bloqueia chunks com token_validation_status = 'exceeded'
if (chunk.token_validation_status === 'exceeded') {
  throw new Error(`Chunk ${chunk.chunk_index} excede limite. SUBDIVIDIR.`);
}

// Bloqueia chunks > 850k tokens
if (!chunk.estimated_tokens || chunk.estimated_tokens > 850000) {
  throw new Error(`Chunk ${chunk.chunk_index} sem validação.`);
}

// Log de segurança
console.log(`📄 Chunk ${chunk.chunk_index} (~${chunk.estimated_tokens} tokens - SAFE)`);
```

### **Validação 2: Linha 578-581**
```typescript
// Validação adicional no modo consolidado
if (chunk.token_validation_status === 'exceeded' ||
    chunk.estimated_tokens > 850000) {
  throw new Error(`Chunk ${chunk.chunk_index} excede limite. Subdividir.`);
}
```

**ESTAS VALIDAÇÕES NÃO EXISTEM EM PRODUÇÃO!**

---

## ⏱️ **TEMPO ESTIMADO**

- **Deploy via CLI:** 2 minutos
- **Deploy via Dashboard:** 5 minutos
- **Verificação:** 2 minutos
- **Teste completo:** 5 minutos

**TOTAL: 10-15 minutos**

---

## 🚨 **PRIORIDADE: MÁXIMA**

**Motivo:** Sistema completamente quebrado para arquivos grandes.

**Impacto:** TODOS os uploads >1000 páginas falham 100% sem este deploy.

**Ação:** **DEPLOY AGORA!**

---

## 📞 **PRÓXIMOS PASSOS APÓS DEPLOY**

1. ✅ Verificar logs (sem erros)
2. ✅ Testar novo upload 3.710 páginas
3. ✅ Confirmar processamento 100% sucesso
4. ✅ Documentar incidente
5. ✅ Adicionar monitoring para detectar futuras regressões

---

## 📝 **ARQUIVOS DE REFERÊNCIA**

- `supabase/functions/process-next-prompt/index.ts` - Código atualizado (990 linhas)
- `DEPLOY_PROCESS_NEXT_PROMPT.md` - Guia detalhado
- `TEMPLATE_EMAIL_COMPLEX_ANALYSIS_ERROR.md` - Sistema de notificação
- Este arquivo: `DEPLOY_URGENTE.md`
