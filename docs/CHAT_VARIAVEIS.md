# Variáveis dos Prompts do Chat

Este documento descreve todas as variáveis que podem ser usadas nos prompts do sistema de chat (Wis Chat).

## Visão Geral

As variáveis permitem personalizar os prompts dinamicamente com informações reais do usuário, do processo e do sistema. Todas as variáveis são substituídas automaticamente antes do prompt ser enviado ao modelo de IA.

## Variáveis do Usuário

### Nome

| Variável | Alternativa | Descrição | Fallback |
|----------|-------------|-----------|----------|
| `{{USUARIO_NOME}}` | `{user_full_name}` | Nome completo do usuário | "Usuário" |
| `{user_first_name}` | - | Primeiro nome | "Usuário" |
| `{user_last_name}` | - | Sobrenome | "" (vazio) |

**Exemplo:**
```
Olá {user_first_name}, bem-vindo ao Wis Chat!
Dr./Dra. {user_last_name}, segue a análise solicitada.
```

### Contato

| Variável | Alternativa | Descrição | Fallback |
|----------|-------------|-----------|----------|
| `{{USUARIO_EMAIL}}` | `{user_email}` | Email do usuário | "N/A" |
| `{user_phone}` | - | Telefone do usuário | "N/A" |
| `{user_phone_country_code}` | - | Código do país | "+55" |

**Exemplo:**
```
Contato: {user_email}
Telefone: {user_phone_country_code} {user_phone}
```

### Dados Profissionais

| Variável | Alternativa | Descrição | Fallback |
|----------|-------------|-----------|----------|
| `{{USUARIO_OAB}}` | `{user_oab}` | Número da OAB | "N/A" |
| `{user_cpf}` | - | CPF do usuário | "N/A" |

**Exemplo:**
```
Advogado: {{USUARIO_NOME}} - OAB {{USUARIO_OAB}}
CPF: {user_cpf}
```

### Localização

| Variável | Alternativa | Descrição | Fallback |
|----------|-------------|-----------|----------|
| `{user_city}` | - | Cidade do usuário | "N/A" |
| `{user_state}` | - | Estado do usuário | "N/A" |

**Exemplo:**
```
Localização: {user_city}/{user_state}
```

## Variáveis do Processo

| Variável | Descrição | Tipo |
|----------|-----------|------|
| `{processo_name}` | Nome do arquivo do processo | String |
| `{total_pages}` | Número total de páginas | Number |
| `{chunks_count}` | Número de chunks (arquivos grandes) | Number |

**Exemplo:**
```
Processo: {processo_name}
Total de páginas: {total_pages}
Dividido em {chunks_count} partes
```

**Nota:** A variável `{chunks_count}` só é relevante para processos grandes (mais de 1000 páginas) que foram divididos em chunks.

## Variáveis do Sistema

| Variável | Descrição | Formato |
|----------|-----------|---------|
| `{{DATA_HORA_ATUAL}}` | Data e hora atual em Brasília | "segunda-feira, 11 de dezembro de 2025 21:30:00 Horário Padrão de Brasília" |

**Exemplo:**
```
CONTEXTO TEMPORAL OBRIGATÓRIO:
HOJE É: {{DATA_HORA_ATUAL}} (Horário de Brasília)
```

## Sintaxes Suportadas

O sistema suporta duas sintaxes para algumas variáveis:

1. **Chaves duplas (estilo template):** `{{VARIAVEL}}`
2. **Chaves simples (estilo placeholder):** `{variavel}`

Ambas funcionam igualmente. Escolha a que preferir para consistência no seu prompt.

### Variáveis com ambas sintaxes:

- `{{USUARIO_NOME}}` = `{user_full_name}`
- `{{USUARIO_EMAIL}}` = `{user_email}`
- `{{USUARIO_OAB}}` = `{user_oab}`

### Variáveis apenas com sintaxe simples:

Todas as outras variáveis usam apenas chaves simples: `{variavel}`

## Comportamento de Fallback

Quando um dado não está disponível (usuário não cadastrou), as variáveis retornam valores padrão:

- **Campos obrigatórios:** Valor padrão genérico
  - Exemplo: `{user_first_name}` → "Usuário"

- **Campos opcionais:** "N/A"
  - Exemplo: `{user_oab}` → "N/A"
  - Exemplo: `{user_cpf}` → "N/A"

Isso garante que os prompts sempre funcionem, mesmo com dados incompletos.

## Variáveis Removidas

### `{processo_number}` - REMOVIDA

A variável `{processo_number}` foi **removida do sistema** pois não fazia sentido no contexto do chat. Se você tiver prompts antigos usando essa variável, ela será simplesmente removida (substituída por string vazia).

## Exemplos Práticos

### Exemplo 1: Prompt Formal com Dados do Advogado

```
Você é um assistente jurídico para o advogado {{USUARIO_NOME}} (OAB: {{USUARIO_OAB}}).

Dados do Advogado:
- Nome: {user_first_name} {user_last_name}
- OAB: {user_oab}
- Email: {user_email}
- Localização: {user_city}/{user_state}

Processo em análise: {processo_name}
Total de páginas: {total_pages}

Data e hora: {{DATA_HORA_ATUAL}}
```

### Exemplo 2: Prompt Informal e Direto

```
Olá {user_first_name}! Estou aqui para ajudar com o processo {processo_name}.

O documento tem {total_pages} páginas e já foi completamente analisado.

Hoje é {{DATA_HORA_ATUAL}}.
```

### Exemplo 3: Cabeçalho de Parecer

```
PARECER JURÍDICO

Processo: {processo_name}
Advogado Responsável: {user_first_name} {user_last_name}
OAB: {{USUARIO_OAB}}
Data: {{DATA_HORA_ATUAL}}

---
```

## Boas Práticas

1. **Use nomes descritivos:** Prefira `{{USUARIO_NOME}}` em contextos formais e `{user_first_name}` em contextos informais.

2. **Teste com dados incompletos:** Sempre teste seus prompts considerando que alguns usuários podem não ter todos os dados cadastrados.

3. **Considere o contexto:** Use variáveis de localização (`{user_city}`, `{user_state}`) apenas quando relevante.

4. **Evite redundância:** Não use múltiplas variáveis para o mesmo dado no mesmo prompt.

5. **Documente seus prompts:** Adicione comentários explicando o propósito de cada variável usada.

## Administração

### Onde editar prompts:

1. Acesse o painel administrativo
2. Navegue até **Configurações de Chat**
3. Selecione o tipo de prompt (small_file, large_file_chunks, audio)
4. Edite o conteúdo do prompt usando as variáveis disponíveis
5. Salve as alterações

### Validação:

O sistema **não valida** as variáveis antes de salvar. Certifique-se de usar apenas as variáveis documentadas neste guia.

## Suporte Técnico

Para dúvidas sobre variáveis ou problemas na substituição:

1. Verifique se a variável está escrita corretamente (case-sensitive)
2. Confirme se o dado está cadastrado no perfil do usuário
3. Consulte os logs das edge functions para debug
4. Verifique a documentação atualizada em `/docs/CHAT_VARIAVEIS.md`

---

**Última atualização:** Dezembro 2025
**Versão:** 1.0
