const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GCS_INPUT_BUCKET_NAME = 'arpj-docai-input';

function logWithContext(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${message}`);
  if (data) {
    console.log(`[${timestamp}] DATA:`, JSON.stringify(data, null, 2));
  }
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const privateKeyPem = serviceAccount.private_key.replace(/\\n/g, '\n');
  const privateKeyDer = Uint8Array.from(
    atob(privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')),
    c => c.charCodeAt(0)
  );

  try {
    const cryptoKey = await crypto.subtle.importKey('pkcs8', privateKeyDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsignedToken));

    const encodedSignature = btoa(String.fromCharCode.apply(null, new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const jwt = `${unsignedToken}.${encodedSignature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Auth Failed: ${data.error_description || data.error} (Status: ${response.status})`);
    }
    return data.access_token;
  } catch (e) {
    throw new Error(`Auth Failed: Erro crítico na geração de chave/assinatura JWT: ${e.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    logWithContext('INFO', '🔗 Create GCS Upload URL - V1');

    const googleServiceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!googleServiceAccountKey) throw new Error('Missing Google Service Account Key');

    const { fileName } = await req.json();
    if (!fileName) {
      throw new Error('Missing required parameter: fileName');
    }

    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_INPUT_BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;
    const gcsUri = `gs://${GCS_INPUT_BUCKET_NAME}/${fileName}`;

    logWithContext('INFO', '✅ GCS Upload URL created successfully', { gcsUri });

    const accessToken = await getAccessToken(googleServiceAccountKey);

    return new Response(JSON.stringify({
      uploadUrl,
      gcsUri,
      accessToken
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logWithContext('ERROR', '❌ Error in create-upload-url:', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});