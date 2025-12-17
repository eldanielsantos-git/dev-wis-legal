# Quick Start

Tutorial rápido para começar a usar o sistema em menos de 10 minutos.

## Pré-requisitos

Antes de começar, certifique-se de ter:

- [ ] [Instalação completa](./installation.md)
- [ ] [Variáveis de ambiente configuradas](./environment-setup.md)
- [ ] Projeto rodando em `http://localhost:5173`

---

## Passo 1: Executar o Projeto

```bash
# Na raiz do projeto
npm run dev
```

Abra o browser em: `http://localhost:5173`

---

## Passo 2: Criar Conta

### 2.1. Acesse a Página de Registro

1. Na homepage, clique em **"Começar Gratuitamente"** ou **"Sign Up"**
2. Ou acesse diretamente: `http://localhost:5173/signup`

### 2.2. Preencha o Formulário

```
Nome: Seu Nome
Email: seu@email.com
Senha: ********** (mínimo 8 caracteres)
```

**Requisitos de Senha:**
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número

### 2.3. Confirme o Email

1. Verifique seu email
2. Clique no link de confirmação
3. Você será redirecionado para o dashboard

**Nota:** Em desenvolvimento local, os emails podem não ser enviados. Neste caso:
- Os emails aparecem no log da Edge Function
- Ou você pode desabilitar verificação de email no Supabase Dashboard

---

## Passo 3: Primeiro Login

Se você fechou o browser ou criou a conta previamente:

1. Acesse `http://localhost:5173/signin`
2. Entre com email e senha
3. Clique em **"Entrar"**

Você será redirecionado para o **Dashboard**.

---

## Passo 4: Conhecer o Dashboard

### 4.1. Elementos Principais

```
┌─────────────────────────────────────────────┐
│  [Logo]  Meus Processos  Chat  Tokens  👤   │  ← Header
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │      Conteúdo Principal         │
│          │                                  │
│  📁 Meus │  • Status de tokens              │
│    Proc. │  • Processos recentes            │
│          │  • Botão "Novo Processo"         │
│  💬 Chat │                                  │
│          │                                  │
│  🎯 Token│                                  │
│          │                                  │
│  👤 Perf │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### 4.2. Navegação

- **Meus Processos**: Lista todos seus processos
- **Chat**: Acesso ao chat (requer processo selecionado)
- **Tokens**: Visualizar saldo, histórico e comprar tokens
- **Perfil**: Configurações da conta

### 4.3. Status Inicial

Você começa com:
- **Plano Free**: 10.000 tokens/mês
- **0 processos** criados
- **0 análises** realizadas

---

## Passo 5: Upload do Primeiro Processo

### 5.1. Preparar um PDF

Para este tutorial, use um PDF de teste:
- Tamanho: Pequeno (< 50 páginas) para teste rápido
- Formato: PDF com texto extraível (não escaneado)
- Conteúdo: Processo judicial (ou qualquer documento legal para teste)

### 5.2. Fazer Upload

1. No dashboard, clique em **"Novo Processo"** ou **"Upload PDF"**
2. Preencha o formulário:

```
Número do Processo: 0001234-56.2024.8.00.0001
Nome/Título: Processo de Teste
Descrição (opcional): Primeiro processo para teste
```

3. Clique em **"Escolher Arquivo"**
4. Selecione seu PDF
5. Clique em **"Iniciar Análise"**

### 5.3. Aguardar Processamento

Você verá uma tela de progresso com:

```
📄 Preparando documento...
✓ Upload concluído
✓ Texto extraído (XXX páginas)
✓ Enviado para processamento

🔄 Analisando processo...
Progresso: 10% (1/10 análises)

• Visão Geral do Processo... ✓
• Resumo Estratégico... 🔄
• Comunicações e Prazos... ⏳
• ...
```

**Tempo estimado:**
- Processo pequeno (< 50 páginas): 2-5 minutos
- Processo médio (50-200 páginas): 5-10 minutos
- Processo grande (200-500 páginas): 10-20 minutos

### 5.4. Monitorar Tokens

Durante o processamento, observe:
- Barra de progresso
- Contagem de tokens sendo consumidos
- Status de cada análise

---

## Passo 6: Visualizar Análise

### 6.1. Acessar o Processo

Quando a análise concluir:
1. Você receberá uma notificação (se habilitado)
2. Na lista de processos, clique no processo
3. Ou acesse via notificação

### 6.2. Explorar as 10 Análises

Você verá 10 cards, um para cada tipo de análise:

**1. Visão Geral do Processo**
```
📋 Dados Básicos
• Número: 0001234-56.2024.8.00.0001
• Classe: Ação Civil
• Assunto: ...

👥 Partes
• Autor: Fulano de Tal
• Réu: Empresa XYZ

📅 Timeline
• Distribuição: 01/01/2024
• Citação: 15/01/2024
• ...
```

**2. Resumo Estratégico**
```
Análise estratégica do processo com pontos principais,
tese central, argumentos, etc.
```

*E assim por diante para os outros 8 tipos...*

### 6.3. Navegar Entre Análises

Use:
- **Tabs** no topo para mudar de análise
- **Sidebar** para navegação rápida
- **Busca** para encontrar informações específicas

### 6.4. Ações Disponíveis

Para cada análise você pode:
- 📥 **Exportar** (PDF, DOCX, JSON)
- 📋 **Copiar** conteúdo
- 🔄 **Regenerar** (consome tokens)
- 🗑️ **Deletar** análise

---

## Passo 7: Interagir via Chat

### 7.1. Abrir o Chat

1. Com o processo aberto, clique em **"Chat"** no menu
2. Ou clique no ícone de chat 💬 no card do processo

### 7.2. Fazer Perguntas

Digite perguntas em linguagem natural:

**Exemplos de Perguntas:**
```
"Quais são os prazos pendentes?"
"Qual o valor da causa?"
"Quem são as testemunhas citadas?"
"Qual a tese de defesa?"
"Houve perícia no processo?"
"Quais documentos foram juntados pelo autor?"
```

### 7.3. Receber Respostas

O assistente responderá baseado no conteúdo do processo:

```
👤 Você: Quais são os prazos pendentes?

🤖 Assistente: De acordo com a análise do processo,
há 2 prazos pendentes:

1. Prazo para contestação: 15 dias a partir de
   20/02/2024 (vencimento em 06/03/2024)

2. Prazo para especificação de provas: 10 dias
   após contestação

Recomendo atenção especial ao prazo de contestação
que está próximo do vencimento.
```

### 7.4. Histórico

- Todo o histórico de conversas fica salvo
- Você pode retomar conversas anteriores
- Chat é específico por processo

### 7.5. Recursos Avançados

- **Áudio**: Clique no ícone de microfone para falar
- **Contexto**: O chat lembra das mensagens anteriores
- **Citações**: Respostas podem incluir citações do processo

---

## Passo 8: Gerenciar Tokens

### 8.1. Verificar Saldo

1. Clique em **"Tokens"** no menu
2. Veja seu saldo atual e histórico

```
💎 Saldo Atual: 8.500 tokens
📊 Consumo do Mês: 1.500 tokens

Histórico:
• Análise - Processo #0001 (-1.200 tokens)
• Chat - 5 mensagens (-300 tokens)
• Bônus mensal (+10.000 tokens)
```

### 8.2. Comprar Tokens

Se necessário:
1. Clique em **"Comprar Tokens"**
2. Escolha um pacote:
   - 10.000 tokens - $9.99
   - 50.000 tokens - $39.99
   - 100.000 tokens - $69.99
3. Complete o pagamento via Stripe

### 8.3. Upgrade de Plano

Para mais tokens mensais:
1. Vá em **"Assinatura"**
2. Compare planos:
   - Free: 10k tokens/mês
   - Pro: 50k tokens/mês ($29.99)
   - Enterprise: 200k tokens/mês ($99.99)
3. Clique em **"Fazer Upgrade"**

---

## Passo 9: Compartilhar Processo

### 9.1. Compartilhar com Outro Usuário

1. Abra o processo
2. Clique em **"Compartilhar"** 🔗
3. Digite o email do usuário
4. Escolha permissão:
   - **Read-only**: Apenas visualizar
   - **Full access**: Editar e deletar
5. Clique em **"Enviar Convite"**

### 9.2. Gerenciar Compartilhamentos

- Veja quem tem acesso
- Remova acesso quando necessário
- Altere permissões

---

## Passo 10: Organizar com Tags

### 10.1. Criar Tags

1. Na lista de processos, clique em um processo
2. Clique em **"+ Tag"**
3. Digite o nome (ex: "Urgente", "Cliente ABC")
4. Escolha uma cor
5. Clique em **"Criar"**

### 10.2. Usar Filtros

- Filtre processos por tag
- Combine múltiplas tags
- Busque por nome ou número

---

## Próximos Passos

Agora que você completou o Quick Start:

1. **Explore a Interface**
   - Teste todos os tipos de análise
   - Experimente o chat com perguntas complexas
   - Configure seu perfil

2. **Leia a Documentação**
   - [Arquitetura do Sistema](../02-architecture/overview.md)
   - [Sistema de Análise](../05-analysis/overview.md)
   - [Chat Sistema](../05-analysis/chat-system.md)

3. **Desenvolva Features**
   - [Guia de Contribuição](../11-contributing/CONTRIBUTING.md)
   - [Frontend](../07-frontend/README.md)
   - [API Reference](../06-api-reference/README.md)

---

## Troubleshooting Rápido

### Upload falha

- Verifique se é PDF válido
- Tamanho máximo: 500MB
- Máximo páginas: 5000

### Análise não inicia

- Verifique saldo de tokens
- Veja logs no console do browser
- Verifique conexão com Supabase

### Chat não responde

- Certifique-se de que análise completou
- Verifique saldo de tokens
- Tente recarregar a página

### Sem tokens

- Compre pacote de tokens
- Faça upgrade do plano
- Aguarde renovação mensal (dia 1)

---

## Comandos Úteis Durante Desenvolvimento

```bash
# Ver logs em tempo real
npm run dev

# Verificar erros de TypeScript
npm run typecheck

# Verificar lint
npm run lint

# Build para testar produção
npm run build && npm run preview
```

---

## Dicas de Uso

1. **Economize Tokens**
   - Use análise simples para processos < 500 páginas
   - Faça perguntas específicas no chat
   - Evite regenerar análises desnecessariamente

2. **Organize Processos**
   - Use tags descritivas
   - Adicione descrições claras
   - Compartilhe com equipe

3. **Aproveite o Chat**
   - Seja específico nas perguntas
   - Use follow-up questions
   - Exporte conversas importantes

4. **Monitore Recursos**
   - Acompanhe consumo de tokens
   - Configure alertas de limite
   - Planeje upgrades

---

## Suporte

Precisa de ajuda?

- 📖 [Documentação Completa](../README.md)
- 🐛 [Troubleshooting](../10-troubleshooting/common-issues.md)
- 💬 [Abrir Issue](https://github.com/repo/issues)
- 📧 Email: suporte@seudominio.com

---

**Parabéns!** 🎉

Você completou o Quick Start e já pode usar o sistema!

---

[← Anterior: Configuração de Ambiente](./environment-setup.md) | [Ver Arquitetura →](../02-architecture/overview.md)
