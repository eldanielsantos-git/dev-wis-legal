# 🚀 Guia de Deployment no Bolt - Tier System

**Para usuários do Bolt.new** - Você não precisa rodar scripts `.sh`!
Todas as funcionalidades estão disponíveis via interface web.

---

## ✅ O QUE VOCÊ TEM AGORA

Três páginas admin que substituem os scripts shell:

| Página | URL | Função |
|--------|-----|--------|
| **Deployment Verification** | `/admin-deployment-verification` | Verifica se tudo está pronto |
| **Feature Flags** | `/admin-feature-flags` | Controla rollout e emergency rollback |
| **Tier Monitoring** | `/admin-tier-monitoring` | Monitora saúde do sistema |

---

## 🎯 PROCESSO SIMPLIFICADO PARA BOLT

### 1️⃣ **ANTES DE HABILITAR (Deploy Inicial)**

Quando você fizer deploy no Bolt, **todas as feature flags virão DESLIGADAS** automaticamente.

**Verificar se está tudo OK:**
1. Acesse: `/admin-deployment-verification`
2. Clique em **"Run Verification"**
3. Aguarde os checks completarem
4. **Resultado esperado:** "All Checks Passed" (verde)

![Deployment Verification](https://via.placeholder.com/600x200/10B981/FFFFFF?text=All+Checks+Passed)

---

### 2️⃣ **ROLLOUT PROGRESSIVO**

Acesse: `/admin-feature-flags`

Você verá:
- **Master Switch:** OFF (sistema desabilitado)
- **Quick Rollout Stages:** 5 botões coloridos
- **Individual Toggles:** Para cada tier

#### Opção A: Rollout Manual (Recomendado para produção)

1. **Enable Master Switch** primeiro
2. Habilite tier por tier manualmente
3. Monitore em `/admin-tier-monitoring`
4. Espere 24-48h entre cada tier

#### Opção B: Quick Rollout (Mais rápido, para testes)

Clique nos botões coloridos:

```
┌──────────────────────────────────────────────────┐
│ [Stage 1]  [Stage 2]  [Stage 3]  [Stage 4]  [Stage 5] │
│   Verde     Amarelo   Laranja     Vermelho   Roxo      │
│   SMALL     MEDIUM    LARGE       XLARGE     MASSIVE   │
│    5%        25%       50%         75%        100%     │
└──────────────────────────────────────────────────┘
```

**Cada botão ativa automaticamente os tiers necessários!**

**Exemplo - Stage 2:**
- Clica em "Stage 2"
- Confirma no popup
- ✅ Habilita automaticamente: `tier_system_enabled`, `tier_system_small`, `tier_system_medium`
- Mensagem de sucesso aparece
- Você pode monitorar em `/admin-tier-monitoring`

---

### 3️⃣ **MONITORAMENTO**

Acesse: `/admin-tier-monitoring`

Você verá em tempo real:
- **Overall Status:** Healthy / Degraded / Unhealthy
- **Component Health:** Database, Flags, Configs, etc.
- **Tier Performance (7 dias):** Success rate, tempo médio, etc.
- **Auto-refresh:** A cada 30 segundos

![Tier Monitoring](https://via.placeholder.com/600x300/2563EB/FFFFFF?text=Tier+System+Healthy)

---

### 4️⃣ **EMERGENCY ROLLBACK** 🚨

Se algo der errado:

1. Vá para: `/admin-feature-flags`
2. Clique no botão vermelho: **"Emergency Rollback"**
3. Confirme
4. **TODAS as flags são desabilitadas em < 5 segundos**
5. Sistema volta automaticamente para modo legado

Alternativamente, você pode:
- Desabilitar apenas o "Master Switch" (desliga tudo)
- Ou desabilitar tiers individuais

---

## 📊 EXEMPLO DE ROLLOUT COMPLETO

### Semana 1: Deploy com tudo OFF
```
1. Deploy no Bolt
2. Acesse /admin-deployment-verification
3. Rode verificação
4. ✅ Tudo OK? Pronto para próxima semana
```

### Semana 2: Teste com admins (Canary)
```
1. Acesse /admin-feature-flags
2. Clique "Stage 1" (SMALL tier)
3. Confirme
4. Monitore em /admin-tier-monitoring por 3-5 dias
5. Tudo OK? Próximo stage
```

### Semana 3: Beta (25-50%)
```
1. Clique "Stage 2" (+ MEDIUM)
2. Monitore 2-3 dias
3. Clique "Stage 3" (+ LARGE)
4. Monitore 2-3 dias
```

### Semana 4: Rollout completo
```
1. Clique "Stage 4" (+ XLARGE)
2. Monitore 2 dias
3. Clique "Stage 5" (+ MASSIVE)
4. 🎉 Rollout completo!
```

---

## 🎮 CONTROLES DISPONÍVEIS

### Em `/admin-feature-flags`:

**1. Master Switch**
- Liga/desliga sistema inteiro
- Botão grande verde/vermelho

**2. Quick Rollout (5 botões)**
- Stage 1: Habilita SMALL (verde)
- Stage 2: Habilita SMALL + MEDIUM (amarelo)
- Stage 3: Habilita SMALL + MEDIUM + LARGE (laranja)
- Stage 4: Habilita SMALL + MEDIUM + LARGE + XLARGE (vermelho)
- Stage 5: Habilita ALL tiers (roxo)

**3. Emergency Rollback**
- Botão vermelho no canto superior direito
- Desabilita TUDO instantaneamente

**4. Individual Toggles**
- Controle fino de cada tier
- Switches verdes quando ligados

**5. Refresh Button**
- Atualiza dados em tempo real

**6. Tier Performance Stats**
- Cards com métricas dos últimos 7 dias

---

## 🔍 TROUBLESHOOTING

### "Checks failed" na Deployment Verification

**Possíveis causas:**
- Migrations não aplicadas
- Edge functions não deployadas
- Tabelas não criadas

**Solução:**
1. Verifique no console do Supabase se as migrations rodaram
2. Verifique se as edge functions estão deployadas
3. Rode a verificação novamente

### "Tier não está sendo usado" mesmo com flag ON

**Checklist:**
1. ✅ Master switch está ON?
2. ✅ Tier específico está ON?
3. ✅ Refresh na página?
4. ✅ Clear cache do browser?
5. ✅ Tier config `is_active = true` no banco?

### Success rate baixa

**Ações:**
1. Acesse `/admin-tier-monitoring`
2. Verifique qual tier está falhando
3. Veja os logs no Supabase
4. Se necessário, desabilite o tier problemático
5. Ou faça Emergency Rollback

---

## 💡 DICAS PRO

### Dica 1: Teste com seu usuário admin primeiro
Antes de habilitar para todos, teste você mesmo:
1. Habilite Stage 1
2. Faça upload de um PDF pequeno
3. Verifique se detecta tier corretamente
4. Confira os badges aparecendo

### Dica 2: Monitore ANTES de avançar
Entre cada stage:
- Espere pelo menos algumas horas
- Verifique métricas em `/admin-tier-monitoring`
- Confirme que success rate está > 95%
- Só então avance para próximo stage

### Dica 3: Use o Emergency Rollback sem medo
É instantâneo e seguro:
- Não perde dados
- Não interrompe processos em andamento
- Sistema volta para modo legado automaticamente
- Você pode re-habilitar depois quando quiser

### Dica 4: Acompanhe os badges
Quando tiers estão ativos, você verá badges em:
- Cards de processos
- Lista de processos
- Tela de upload (com estimativa)

---

## ⚠️ IMPORTANTE

### NÃO precisa:
- ❌ Rodar scripts `.sh`
- ❌ Ter acesso a terminal
- ❌ Instalar nada
- ❌ Configurar variáveis de ambiente manualmente

### Tudo funciona via browser! ✅

### Scripts `.sh` são opcionais
Os scripts na pasta `scripts/` são úteis para:
- Equipes DevOps com acesso a terminal
- CI/CD pipelines
- Automações

**No Bolt, você não precisa deles!**

---

## 🎯 CHECKLIST RÁPIDO

**Antes do primeiro rollout:**
- [ ] Deploy realizado
- [ ] Acesso admin funcionando
- [ ] Verificação passou em `/admin-deployment-verification`
- [ ] Feature flags visíveis em `/admin-feature-flags`
- [ ] Todas as flags estão OFF inicialmente

**Durante rollout:**
- [ ] Habilitar stages progressivamente
- [ ] Monitorar em `/admin-tier-monitoring` entre stages
- [ ] Success rate > 95% antes de avançar
- [ ] Documentar qualquer issue

**Pós-rollout completo:**
- [ ] Todos os 5 stages habilitados
- [ ] Sistema stable por 1 semana
- [ ] Métricas positivas
- [ ] Usuários satisfeitos

---

## 📞 SUPORTE

Se tiver problemas:

1. **Verifique logs:** Console do browser + Supabase logs
2. **Emergency rollback:** Sempre disponível em `/admin-feature-flags`
3. **Documentação:** Leia `TIER_SYSTEM_OVERVIEW.md` para detalhes técnicos
4. **Reinicie:** Clear cache, hard refresh, tente novamente

---

## 🎉 RESUMO

**Para usuários do Bolt:**

1. ✅ **Deploy** → Tudo vem OFF
2. ✅ **Verifique** → `/admin-deployment-verification`
3. ✅ **Habilite** → `/admin-feature-flags` (clique stages ou toggles)
4. ✅ **Monitore** → `/admin-tier-monitoring`
5. ✅ **Rollback** → Se precisar, botão vermelho

**Tudo via web, sem precisar de terminal!**

---

**Última atualização:** 2025-12-05
**Versão:** 1.0.0 (Bolt-optimized)
**Status:** Production Ready
