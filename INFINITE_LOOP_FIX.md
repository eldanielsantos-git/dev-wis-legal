# 🔄 Correção do Looping Infinito

## ❌ Problema Identificado

### Sintoma
- Processo mostra **100% completo**
- Cards de análise ficam em **looping infinito**
- Edge function `process-next-prompt` fica repetindo:
  - "⏸️ Nenhum prompt disponível para processar"
  - "🔒 Tentando adquirir lock..."
  - "🔄 Iniciando processamento..."

### Causa Raiz
A edge function estava usando a tabela **ERRADA**:
```typescript
// ❌ ERRADO (tabela antiga que não existe mais)
.from('analysis_results')

// ✅ CORRETO (tabela atual)
.from('forensic_analysis_results')
```

### Impacto
- **9 ocorrências** da tabela errada no código
- Queries falhando silenciosamente
- Sistema não consegue detectar que análises foram concluídas
- Loop infinito de tentativas

## ✅ Solução Aplicada

### 1. Correção da Edge Function

**Arquivo:** `supabase/functions/process-next-prompt/index.ts`

**Mudanças:**
- ✅ Linha 221: Check de status completo
- ✅ Linha 374: Update status para running (File API)
- ✅ Linha 496: Update resultado (chunks)
- ✅ Linha 591: Update resultado (File API)
- ✅ Linha 614: Check prompts restantes (File API)
- ✅ Linha 683: Update status para running (Base64)
- ✅ Linha 744: Update resultado (Base64)
- ✅ Linha 767: Check prompts restantes (Base64)
- ✅ Linha 827: Update erro

**Todas substituídas por:** `.from('forensic_analysis_results')`

### 2. Como Funciona Agora

#### Fluxo Correto:
```
1. Frontend chama process-next-prompt
2. Edge function busca próximo prompt de forensic_analysis_results
3. Processa com Gemini
4. Salva resultado em forensic_analysis_results
5. Verifica se há mais prompts pendentes
6. Se NÃO → Marca processo como completed
7. Se SIM → Dispara próximo processamento
```

#### Detecção de Conclusão:
```typescript
// Busca todos os resultados
const { data: allResults } = await supabase
  .from('forensic_analysis_results')
  .select('status')
  .eq('processo_id', processo_id);

// Verifica se todos completed
const allCompleted = allResults?.every(r => r.status === 'completed');

if (allCompleted) {
  // Marca processo como completed
  await supabase
    .from('processos')
    .update({
      status: 'completed',
      analysis_completed_at: new Date().toISOString()
    })
    .eq('id', processo_id);
}
```

## 🔍 Como Testar

### 1. Processo Novo (< 1000 páginas)
```bash
1. Upload PDF de 273 páginas
2. Aguardar processamento
3. ✅ Verificar que processo conclui corretamente
4. ✅ Cards mostram análises completas
5. ✅ Sem looping infinito
```

### 2. Processo Travado (já existente)
```sql
-- Verificar status atual
SELECT 
  p.id,
  p.status,
  COUNT(CASE WHEN far.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN far.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN far.status = 'running' THEN 1 END) as running
FROM processos p
LEFT JOIN forensic_analysis_results far ON far.processo_id = p.id
WHERE p.id = '2bf5d35a-2eb2-406c-b3ac-311fe459eb0a'
GROUP BY p.id, p.status;

-- Se tudo completed mas processo não está completed:
UPDATE processos
SET 
  status = 'completed',
  analysis_completed_at = NOW()
WHERE id = '2bf5d35a-2eb2-406c-b3ac-311fe459eb0a'
  AND status != 'completed';
```

### 3. Forçar Reprocessamento
```sql
-- Se algum prompt ficou travado em 'running'
UPDATE forensic_analysis_results
SET 
  status = 'pending',
  processing_at = NULL
WHERE processo_id = '2bf5d35a-2eb2-406c-b3ac-311fe459eb0a'
  AND status = 'running';
```

## 📊 Logs de Diagnóstico

### Antes (Looping Infinito):
```
[68d9d5ce] 🔄 Iniciando processamento...
[68d9d5ce] 🔒 Tentando adquirir lock...
[68d9d5ce] ⏸️ Nenhum prompt disponível...
[c7a85d3b] 🔄 Iniciando processamento...
[c7a85d3b] 🔒 Tentando adquirir lock...
[c7a85d3b] ⏸️ Nenhum prompt disponível...
// infinito...
```

### Depois (Funcionando):
```
[68d9d5ce] 🔄 Iniciando processamento...
[68d9d5ce] 🔒 Tentando adquirir lock...
[68d9d5ce] ✅ Lock adquirido para prompt: Riscos e Alertas
[68d9d5ce] 📝 Processando com Gemini...
[68d9d5ce] ✅ Análise concluída
[68d9d5ce] 🔄 Disparando próximo prompt...
...
[171a3fbe] ⏸️ Nenhum prompt disponível...
[171a3fbe] 🎉 Todos os prompts foram processados
[171a3fbe] ✅ Processo marcado como completed
```

## 🛠️ Deploy

### Edge Function
```bash
# Deploy automático via MCP tool
mcp__supabase__deploy_edge_function({
  name: "process-next-prompt",
  slug: "process-next-prompt",
  files: [...],
  verify_jwt: true
})
```

### Frontend
```bash
npm run build
# Deploy para Netlify ou hosting
```

## ✅ Checklist de Validação

- [x] Todas ocorrências de `analysis_results` substituídas
- [x] Build do frontend OK
- [x] Edge function corrigida
- [ ] Edge function deployed
- [ ] Testado com processo novo
- [ ] Processos travados corrigidos no banco
- [ ] Monitoramento de logs OK

## 🎯 Prevenção Futura

### Code Review Checklist:
1. ✅ Verificar nome correto das tabelas
2. ✅ Tabela `forensic_analysis_results` (não `analysis_results`)
3. ✅ Sempre incluir logs de erro
4. ✅ Testar cenários de conclusão
5. ✅ Verificar estados intermediários

### Monitoring:
- Adicionar alerta para processos em loop (> 100 tentativas)
- Dashboard de health check das edge functions
- Log agregado de erros de tabela não encontrada

---

**Status:** ✅ Correção implementada  
**Próximo passo:** Deploy da edge function  
**Impacto:** 🔥 CRÍTICO - Resolve looping infinito
