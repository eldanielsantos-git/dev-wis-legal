# 🔐 Guia: Criar Policies de Storage para Bucket Processos

## 🎯 Situação Atual

O bucket `processos` está **público temporariamente** para permitir uploads. Isso funciona mas **não é seguro** pois qualquer pessoa pode acessar os arquivos.

**Precisamos criar policies de RLS para:**
1. ✅ Permitir uploads
2. ✅ Manter segurança (cada usuário só acessa seus arquivos)
3. ✅ Tornar o bucket privado novamente

---

## 🚀 SOLUÇÃO RÁPIDA (5 minutos)

### **Opção 1: Policies Simples (Menos Seguro)**

**Use se:** Você quer que funcione rápido e não se importa que usuários vejam arquivos de outros

**Arquivo:** `CREATE_STORAGE_POLICIES_SIMPLE.sql`

**O que faz:**
- ✅ Permite qualquer usuário autenticado fazer upload no bucket
- ✅ Permite qualquer usuário autenticado ver arquivos no bucket
- ⚠️ NÃO isola por usuário (menos seguro)

---

### **Opção 2: Policies Seguras (RECOMENDADO) ⭐**

**Use se:** Você quer máxima segurança (RECOMENDADO)

**Arquivo:** `CREATE_STORAGE_POLICIES_SECURE.sql`

**O que faz:**
- ✅ Usuários só podem fazer upload na **sua própria pasta** (`user_id/arquivo.pdf`)
- ✅ Usuários só podem **ver seus próprios arquivos**
- ✅ Usuários só podem **deletar seus próprios arquivos**
- ✅ **Admins** podem gerenciar **TODOS** os arquivos
- ✅ Torna o bucket **privado** automaticamente

---

## 📋 PASSO A PASSO

### **Passo 1: Escolha o Script**

Recomendo usar **`CREATE_STORAGE_POLICIES_SECURE.sql`** (versão segura)

---

### **Passo 2: Acesse o SQL Editor**

1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral → **SQL Editor**
4. Botão verde → **New query**

---

### **Passo 3: Execute o Script**

1. **Copie TODO o conteúdo** do arquivo escolhido
2. **Cole no editor SQL**
3. **Clique em RUN** (botão verde, canto inferior direito)
4. **Aguarde** a mensagem: `Success. No rows returned`

---

### **Passo 4: Verifique**

Após executar, você deve ver no final do resultado:

```
policyname                                    | cmd    | roles
----------------------------------------------+--------+---------------
Admins can manage all files                   | ALL    | {authenticated}
Authenticated users can upload to processos   | INSERT | {authenticated}
Users can delete their own files              | DELETE | {authenticated}
Users can view their own files                | SELECT | {authenticated}
```

✅ **4 policies criadas!**

---

### **Passo 5: Teste o Upload**

1. Vá para o site
2. Tente fazer upload de um arquivo
3. ✅ **Deve funcionar!**
4. ✅ **Arquivo só é visível para você** (se usou versão segura)

---

## 🔍 Como Funciona a Segurança (Versão Segura)

### **Estrutura de Pastas**

```
bucket: processos/
├── [user_id_1]/
│   ├── 1234567890-arquivo1.pdf   ← Só user_id_1 vê
│   └── 1234567891-arquivo2.pdf   ← Só user_id_1 vê
├── [user_id_2]/
│   ├── 1234567892-documento.pdf  ← Só user_id_2 vê
│   └── 1234567893-contrato.pdf   ← Só user_id_2 vê
```

### **Validação da Policy**

```sql
(storage.foldername(name))[1] = auth.uid()::text
```

**Exemplo:**
- Arquivo: `45ef022b-5963-42b9-9bc3-936a1d3de22a/1732742400000-doc.pdf`
- `foldername(name)[1]` extrai: `45ef022b-5963-42b9-9bc3-936a1d3de22a`
- `auth.uid()` retorna: ID do usuário logado
- ✅ Se iguais → Permite acesso
- ❌ Se diferentes → Bloqueia acesso

---

## ⚠️ IMPORTANTE: Escolher a Versão Certa

### **Use SIMPLE se:**
- ❌ Você não se importa com segurança por enquanto
- ❌ Você quer apenas que funcione
- ❌ Você vai configurar segurança depois

### **Use SECURE se:** ⭐
- ✅ Você quer máxima segurança (RECOMENDADO)
- ✅ Cada usuário deve ver apenas seus arquivos
- ✅ Você quer isolamento por usuário
- ✅ Você tem admins que precisam ver tudo

---

## 🚨 Se Já Executou a Versão SIMPLE

Se você já executou `CREATE_STORAGE_POLICIES_SIMPLE.sql` e quer atualizar para a versão segura:

1. Execute `CREATE_STORAGE_POLICIES_SECURE.sql`
2. O script vai **substituir** as policies antigas
3. ✅ Pronto! Agora está seguro

---

## 🔐 Diferenças Entre as Versões

| Aspecto | SIMPLE | SECURE |
|---------|--------|--------|
| Upload | Qualquer pasta | Só sua pasta |
| Ver arquivos | Todos os arquivos | Só seus arquivos |
| Deletar | ❌ Não tem policy | Só seus arquivos |
| Admins | ❌ Sem privilégios especiais | ✅ Acesso total |
| Segurança | ⚠️ Baixa | ✅ Alta |
| Bucket público | Fica público | Torna privado |

---

## ✅ Checklist

- [ ] Escolher versão (SIMPLE ou SECURE)
- [ ] Abrir SQL Editor no Supabase Dashboard
- [ ] Copiar conteúdo do arquivo SQL
- [ ] Colar no editor
- [ ] Clicar em RUN
- [ ] Ver "Success. No rows returned"
- [ ] Ver lista de 2 ou 4 policies criadas
- [ ] Testar upload no site
- [ ] ✅ Upload funciona!
- [ ] ✅ Arquivo aparece na lista!

---

## 🎯 Qual Versão Eu Recomendo?

### **🌟 USE A VERSÃO SECURE! 🌟**

**Motivos:**
1. ✅ **Segurança máxima** - Usuários não veem arquivos de outros
2. ✅ **Conformidade LGPD** - Dados isolados por usuário
3. ✅ **Controle admin** - Admins podem gerenciar tudo
4. ✅ **Bucket privado** - Arquivos não são públicos
5. ✅ **Zero esforço extra** - Mesma facilidade de uso

**A única diferença é que a versão SECURE protege os dados dos seus usuários!**

---

## 📞 Próximos Passos

1. ✅ Execute `CREATE_STORAGE_POLICIES_SECURE.sql`
2. ✅ Teste o upload
3. ✅ Verifique que funciona
4. 🚀 Pronto para produção!

---

## 🔧 Troubleshooting

### **"Error: permission denied for table objects"**
- Você não está logado como owner do projeto
- Faça login novamente no Supabase Dashboard

### **"Error: policy already exists"**
- As policies já foram criadas
- Execute a query de verificação:
  ```sql
  SELECT policyname, cmd FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects';
  ```

### **Upload ainda não funciona**
- Verifique se o bucket está privado ou público:
  ```sql
  SELECT name, public FROM storage.buckets WHERE name = 'processos';
  ```
- Se estiver privado mas sem policies → Execute o script novamente
- Se estiver público → Execute a versão SECURE que torna privado

---

**Execute o script SQL agora e terá um sistema seguro!** 🚀
