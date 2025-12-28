import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    const envStatus = {
      SUPABASE_URL: supabaseUrl ? `Set (${supabaseUrl.substring(0, 30)}...)` : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? `Set (${supabaseServiceKey.substring(0, 20)}...)` : 'NOT SET',
      GEMINI_API_KEY: geminiApiKey ? `Set (${geminiApiKey.substring(0, 20)}...)` : 'NOT SET',
    };

    console.log('Environment variables status:', envStatus);

    return new Response(
      JSON.stringify({
        success: true,
        env_vars: envStatus,
        all_present: !!(supabaseUrl && supabaseServiceKey && geminiApiKey),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`Erro:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao verificar variáveis',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});