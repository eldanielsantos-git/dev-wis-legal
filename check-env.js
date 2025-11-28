#!/usr/bin/env node

/**
 * Script para verificar se as variáveis de ambiente estão configuradas
 *
 * USO:
 * node check-env.js
 */

console.log('\n🔍 Verificando variáveis de ambiente...\n');

const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY'
];

let hasErrors = false;

requiredVars.forEach(varName => {
  const value = process.env[varName];

  if (!value) {
    console.log(`❌ ${varName}: FALTANDO`);
    hasErrors = true;
  } else {
    // Mostra apenas os primeiros e últimos caracteres
    const preview = value.length > 20
      ? `${value.substring(0, 15)}...${value.substring(value.length - 5)}`
      : value;
    console.log(`✅ ${varName}: ${preview}`);
  }
});

console.log('\n' + '─'.repeat(60) + '\n');

if (hasErrors) {
  console.log('❌ ERRO: Algumas variáveis de ambiente estão faltando!\n');
  console.log('📋 Para configurar localmente:');
  console.log('   1. Copie o arquivo .env.example para .env');
  console.log('   2. cp .env.example .env\n');
  console.log('📋 Para configurar no Netlify:');
  console.log('   1. Acesse: Site Settings → Environment Variables');
  console.log('   2. Adicione cada variável manualmente');
  console.log('   3. Faça um novo deploy\n');
  console.log('📖 Veja o arquivo CONFIGURAR_ENV_NETLIFY.md para instruções completas.\n');
  process.exit(1);
} else {
  console.log('✅ Todas as variáveis de ambiente estão configuradas!\n');
  process.exit(0);
}
