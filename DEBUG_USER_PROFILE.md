# 🔍 Diagnóstico: Dados do Usuário Não Carregam

## Situação Verificada no Banco de Dados

✅ **Dados existem no auth.users:**
- ID: `87a4f9e4-db30-4dfe-957d-8122b66b7015`
- Email: `daniel@dmzdigital.com.br`
- Usuário criado em: 2025-10-06

✅ **Dados existem no user_profiles:**
- ID: `87a4f9e4-db30-4dfe-957d-8122b66b7015`
- Nome: Daniel Santos
- Email: daniel@dmzdigital.com.br
- is_admin: true
- Telefone: +55 11987556013
- Cidade: São Paulo
- Estado: SP

✅ **Policies RLS estão corretas:**
- Usuários podem ler seu próprio perfil
- Admins podem ler todos os perfis
- Trigger de criação de perfil foi recriado

## 🧪 Script de Diagnóstico para Console do Navegador

Abra o **Console do Navegador** (F12 → Console) e cole este código:

```javascript
// ========================================
// DIAGNÓSTICO COMPLETO DO PERFIL
// ========================================

(async function diagnosticUserProfile() {
  console.log('='.repeat(60));
  console.log('🔍 DIAGNÓSTICO DO PERFIL DO USUÁRIO');
  console.log('='.repeat(60));

  // 1. Verificar se Supabase está disponível
  if (typeof window.supabase === 'undefined') {
    console.error('❌ Supabase client não está disponível no window');
    return;
  }

  // 2. Verificar sessão atual
  const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();

  if (sessionError) {
    console.error('❌ Erro ao buscar sessão:', sessionError);
    return;
  }

  if (!session) {
    console.error('❌ Nenhuma sessão ativa encontrada');
    return;
  }

  console.log('✅ Sessão ativa encontrada');
  console.log('   User ID:', session.user.id);
  console.log('   Email:', session.user.email);
  console.log('   Auth Provider:', session.user.app_metadata?.provider);

  // 3. Testar query direta para user_profiles
  console.log('\n📊 Testando query para user_profiles...');

  const { data: profileData, error: profileError } = await window.supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('❌ ERRO ao buscar perfil:', profileError);
    console.error('   Código:', profileError.code);
    console.error('   Mensagem:', profileError.message);
    console.error('   Detalhes:', profileError.details);
    console.error('   Hint:', profileError.hint);
    return;
  }

  if (!profileData) {
    console.error('❌ PERFIL NÃO ENCONTRADO');
    console.log('   User ID buscado:', session.user.id);
    return;
  }

  console.log('✅ PERFIL ENCONTRADO:');
  console.log('   ID:', profileData.id);
  console.log('   Nome:', profileData.first_name, profileData.last_name);
  console.log('   Email:', profileData.email);
  console.log('   Admin:', profileData.is_admin);
  console.log('   Telefone:', profileData.phone);
  console.log('   Cidade/Estado:', profileData.city, profileData.state);
  console.log('   Avatar:', profileData.avatar_url);

  // 4. Verificar se AuthContext está carregando
  console.log('\n🔄 Verificando AuthContext...');

  // Aguardar um pouco para o React renderizar
  setTimeout(() => {
    const authContextEl = document.querySelector('[data-auth-context]');
    if (authContextEl) {
      console.log('✅ AuthContext está montado');
    } else {
      console.log('⚠️ AuthContext pode não estar montado corretamente');
    }
  }, 1000);

  console.log('\n' + '='.repeat(60));
  console.log('✅ DIAGNÓSTICO CONCLUÍDO');
  console.log('='.repeat(60));

  return profileData;
})();
```

## 🔧 Se o diagnóstico mostrar "PERFIL ENCONTRADO"

Significa que o banco está OK e o problema é no frontend. Verifique:

1. **Console do navegador** - procure por erros em vermelho
2. **Network tab** - veja se há requests falhando
3. **React DevTools** - verifique o estado do AuthContext

## 🔧 Se o diagnóstico mostrar "ERRO ao buscar perfil"

O problema está nas policies RLS. Anote o erro exato e me informe.

## 🔧 Se o diagnóstico mostrar "PERFIL NÃO ENCONTRADO"

O perfil não existe para esse usuário. Precisamos criá-lo manualmente.

## 📋 Próximos Passos

Execute o script acima e me envie a saída completa do console.
