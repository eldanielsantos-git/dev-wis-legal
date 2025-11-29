import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const email = 'daniel098@dmzdigital.com.br';

console.log(`📧 Reenviando email de confirmação para: ${email}`);

// Buscar dados do usuário
const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();

if (authError) {
  console.error('❌ Erro ao buscar usuários:', authError);
  process.exit(1);
}

const user = authUser.users.find(u => u.email === email);

if (!user) {
  console.error('❌ Usuário não encontrado');
  process.exit(1);
}

console.log('✓ Usuário encontrado:', user.id);

// Buscar nome do perfil
const { data: profile, error: profileError } = await supabase
  .from('user_profiles')
  .select('first_name')
  .eq('id', user.id)
  .single();

if (profileError) {
  console.error('❌ Erro ao buscar perfil:', profileError);
  process.exit(1);
}

const firstName = profile?.first_name || email.split('@')[0];
console.log('✓ Nome encontrado:', firstName);

// Chamar a edge function
console.log('\n📤 Chamando edge function...');

const { data, error } = await supabase.functions.invoke('send-confirmation-email', {
  body: {
    user_id: user.id,
    email: email,
    first_name: firstName
  }
});

if (error) {
  console.error('❌ Erro ao enviar email:', error);
  process.exit(1);
}

console.log('\n✅ Email enviado com sucesso!');
console.log('Resposta:', data);
