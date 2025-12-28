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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const processo_id = '864a047b-e2f6-4197-bfa0-a33040d43eb4';

    console.log(`🚀 Disparando process-next-prompt para processo ${processo_id} com service key`);

    const response = await fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ processo_id }),
    });

    const result = await response.json();

    console.log(`Response status: ${response.status}`);
    console.log(`Response body:`, JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`❌ Erro:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao disparar recuperação',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});