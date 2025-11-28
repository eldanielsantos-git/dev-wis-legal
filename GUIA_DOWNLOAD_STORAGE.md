# 📦 Guia de Download dos Buckets do Supabase Storage

## Opção 1: Script Node.js Automatizado (Recomendado)

Este método baixa TODOS os arquivos de TODOS os buckets automaticamente.

### Pré-requisitos

1. Node.js instalado
2. Service Role Key do Supabase

### Passo a Passo

#### 1. Obter a Service Role Key

1. Acesse: https://supabase.com/dashboard/project/zvlqcxiwsrziuodiotar/settings/api
2. Copie a **service_role key** (seção "Project API keys")

#### 2. Configurar a Variável de Ambiente

**No Linux/Mac:**
```bash
export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key_aqui"
```

**No Windows (PowerShell):**
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key_aqui"
```

**No Windows (CMD):**
```cmd
set SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

#### 3. Instalar Dependência

```bash
npm install @supabase/supabase-js
```

#### 4. Executar o Script

```bash
node download-storage.js
```

### O Que o Script Faz

- ✅ Lista todos os arquivos de cada bucket recursivamente
- ✅ Cria a estrutura de pastas localmente
- ✅ Baixa cada arquivo preservando a hierarquia
- ✅ Pula arquivos já baixados (idempotente)
- ✅ Exibe progresso em tempo real
- ✅ Gera relatório final com estatísticas

### Buckets que Serão Baixados

1. `blog-img` - Imagens de blog
2. `chat-audios` - Áudios de mensagens de chat
3. `processos` - PDFs dos processos
4. `avatars` - Avatares dos usuários
5. `assets` - Assets gerais
6. `legal-documents` - Documentos legais
7. `files` - Arquivos diversos

### Saída Esperada

```
🚀 Iniciando download de todos os buckets do Supabase Storage

📁 Diretório de saída: /path/to/storage_backup

📦 Processando bucket: blog-img
   📋 Listando arquivos...
   ✅ Encontrados 5 arquivos
   ✅ [1/5] Baixado: logo.png (12.34 KB)
   ✅ [2/5] Baixado: banner.jpg (45.67 KB)
   ...

============================================================
📊 RESUMO DO DOWNLOAD
============================================================

📦 blog-img:
   Total: 5 arquivos
   ✅ Baixados: 5
   ⏭️  Pulados: 0
   ❌ Falhas: 0

📦 chat-audios:
   Total: 12 arquivos
   ✅ Baixados: 12
   ⏭️  Pulados: 0
   ❌ Falhas: 0

... (outros buckets)

============================================================
📈 TOTAIS:
   Total de arquivos: 150
   ✅ Baixados: 150
   ⏭️  Pulados: 0
   ❌ Falhas: 0
   ⏱️  Tempo: 45.32s
============================================================

✅ Todos os arquivos foram baixados com sucesso!

📁 Arquivos salvos em: /path/to/storage_backup
```

### Estrutura de Saída

```
storage_backup/
├── blog-img/
│   ├── logo.png
│   └── banner.jpg
├── chat-audios/
│   ├── user123/
│   │   ├── audio1.mp3
│   │   └── audio2.mp3
│   └── user456/
│       └── audio3.mp3
├── processos/
│   ├── processo1.pdf
│   ├── processo2.pdf
│   └── ...
├── avatars/
│   ├── user1/avatar.jpg
│   ├── user2/avatar.png
│   └── ...
├── assets/
├── legal-documents/
└── files/
```

---

## Opção 2: Download Manual via Dashboard (Simples mas Tedioso)

### Passo a Passo

1. Acesse: https://supabase.com/dashboard/project/zvlqcxiwsrziuodiotar/storage/buckets
2. Para cada bucket:
   - Clique no bucket
   - Navegue pelas pastas
   - Clique nos 3 pontinhos de cada arquivo
   - Clique em "Download"

**Desvantagens:**
- ❌ Muito manual e demorado
- ❌ Não preserva estrutura de pastas
- ❌ Não funciona para buckets com muitos arquivos

---

## Opção 3: Lista de URLs para Download Manual

Vou criar uma Edge Function que gera uma lista de URLs assinadas para você baixar:

### 1. Criar Edge Function

Execute este comando no Postman:

**Endpoint:**
```
POST https://zvlqcxiwsrziuodiotar.supabase.co/functions/v1/list-storage-files
```

**Headers:**
```
Authorization: Bearer SEU_TOKEN_ADMIN
Content-Type: application/json
```

**Body:**
```json
{
  "bucket": "processos"
}
```

**Resposta:** Lista de arquivos com URLs para download

### 2. Use um Download Manager

Com a lista de URLs, use ferramentas como:
- **wget** (Linux/Mac)
- **aria2c** (multiplataforma)
- **IDM** (Windows)

---

## Opção 4: Backup via Supabase CLI

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Login

```bash
supabase login
```

### 3. Link ao Projeto

```bash
supabase link --project-ref zvlqcxiwsrziuodiotar
```

### 4. Baixar Storage

```bash
# Download de um bucket específico
supabase storage download processos --recursive

# Download de todos os buckets
for bucket in blog-img chat-audios processos avatars assets legal-documents files; do
  supabase storage download $bucket --recursive
done
```

---

## Comparação das Opções

| Método | Facilidade | Velocidade | Automação | Estrutura Preservada |
|--------|-----------|-----------|-----------|---------------------|
| Script Node.js | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ✅ |
| Dashboard Manual | ⭐⭐ | ⭐ | ❌ | ❌ |
| Edge Function + wget | ⭐⭐⭐ | ⭐⭐⭐⭐ | Parcial | ✅ |
| Supabase CLI | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ✅ |

---

## Recomendação

Use o **Script Node.js** (`download-storage.js`) porque:
- ✅ Totalmente automatizado
- ✅ Rápido e eficiente
- ✅ Preserva estrutura de pastas
- ✅ Idempotente (pode executar múltiplas vezes)
- ✅ Relatório detalhado
- ✅ Não requer CLI adicional

---

## Troubleshooting

### Erro: "SUPABASE_SERVICE_ROLE_KEY não definida"
**Solução:** Defina a variável de ambiente antes de executar

### Erro: "Cannot find module '@supabase/supabase-js'"
**Solução:** Execute `npm install @supabase/supabase-js`

### Arquivos muito grandes falhando
**Solução:** Aumente o timeout no script ou baixe manualmente

### Permissão negada para bucket privado
**Solução:** Use a service_role key (não a anon key)

---

## Próximos Passos Após Download

1. Verifique o tamanho total: `du -sh storage_backup`
2. Comprima para backup: `tar -czf storage_backup.tar.gz storage_backup/`
3. Faça upload para o novo projeto
4. Verifique a integridade dos arquivos

---

## Fazer Upload no Novo Projeto

Depois de baixar, você pode fazer upload no ARRJ-Dev:

```javascript
// Script para fazer upload
node upload-to-new-storage.js
```

(Um script de upload pode ser criado se necessário)
