# Fix Microsoft Login - Erro PKCE Cross-Origin

## ✅ Configuração Correta no Azure Portal

### 1. Ir para Authentication
```
Azure Portal → App Registrations → Wis-Legal-APP → Authentication
```

### 2. Platform Configuration
**DEVE ter apenas UMA plataforma:**

✅ **Single-page application** (SPA)
```
Redirect URIs:
https://rslpleprodloodfsaext.supabase.co/auth/v1/callback
```

❌ **Remover qualquer outra plataforma:**
- ❌ Web (isso causa o erro de PKCE!)
- ❌ Mobile and desktop applications

### 3. Implicit grant and hybrid flows
**NADA deve estar marcado:**
- ☐ Access tokens
- ☐ ID tokens

### 4. Advanced settings (final da página)
**Allow public client flows:** NO (desmarcar)

### 5. Salvar
Clique em **"Save"** no topo e aguarde 2-3 minutos.

---

## 🔍 Por que acontece o erro?

O erro acontece quando o Azure está configurado como "Web application" em vez de "SPA":

- **Web application** → Espera Server-Side (precisa criar rota callback)
- **SPA** → Client-Side funciona automaticamente

---

## ✅ Código Atual (já está correto)

```typescript
const signInWithMicrosoft = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: window.location.origin,
      scopes: 'email',
    },
  });
  if (error) throw error;
};
```

---

## 📋 Checklist Final

- [ ] Remover plataforma "Web" se existir
- [ ] Manter apenas "Single-page application"
- [ ] Redirect URI: `https://rslpleprodloodfsaext.supabase.co/auth/v1/callback`
- [ ] Implicit grant: NADA marcado
- [ ] Allow public client flows: NO
- [ ] Salvar e aguardar 2-3 minutos
- [ ] Testar em aba anônima

---

## 🎯 Depois de Configurar

1. Aguarde 2-3 minutos (propagação do Azure)
2. Limpe o cache do navegador (Ctrl+Shift+Del)
3. Abra aba anônima
4. Acesse: https://dev-app.wislegal.io
5. Clique em "Login com Microsoft"
6. Deve funcionar!

---

## ℹ️ Sobre o `exchangeCodeForSession`

Esse código é para **SSR (Server-Side Rendering)**:
- Next.js App Router
- SvelteKit
- Remix

Vocês usam **SPA (Vite + React)** - não precisa criar rota callback!
