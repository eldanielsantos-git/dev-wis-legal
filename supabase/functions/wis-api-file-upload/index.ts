import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ZApiDocument {
  title?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
  pageCount?: number;
  documentUrl?: string;
}

interface RequestPayload {
  phone?: string;
  fileName?: string;
  documentUrl?: string;
  base64?: string;
  mimeType?: string;
  instanceUrl?: string;
  instanceId?: string;
  document?: ZApiDocument;
  type?: string;
}

interface ErrorMessage {
  error_key: string;
  message_text: string;
}

function sanitizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^55/, '');
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0000-\u001f\u007f-\u009f/\\?%*:|"<>]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function getErrorMessage(
  supabase: ReturnType<typeof createClient>,
  errorKey: string,
  replacements: Record<string, string> = {}
): Promise<string> {
  const { data } = await supabase
    .from('wis_api_error_messages')
    .select('message_text')
    .eq('error_key', errorKey)
    .maybeSingle();

  let message = data?.message_text || `Erro: ${errorKey}`;

  for (const [key, value] of Object.entries(replacements)) {
    message = message.replace(`{${key}}`, value);
  }

  return message;
}

async function logRequest(
  supabase: ReturnType<typeof createClient>,
  partnerId: string | null,
  phoneNumber: string,
  userId: string | null,
  success: boolean,
  errorKey: string | null,
  requestPayload: Record<string, unknown>,
  responseSent: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('wis_api_logs').insert({
      partner_id: partnerId,
      phone_number: phoneNumber,
      user_id: userId,
      success,
      error_key: errorKey,
      request_payload: requestPayload,
      response_sent: responseSent,
    });
  } catch (error) {
    console.error('Error logging request:', error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let requestPayload: RequestPayload | null = null;
  let partnerId: string | null = null;
  let userId: string | null = null;
  let cleanPhone = '';

  try {
    requestPayload = await req.json() as RequestPayload;

    const phone = requestPayload.phone;
    const fileName = requestPayload.document?.fileName || requestPayload.fileName;
    const documentUrl = requestPayload.document?.documentUrl || requestPayload.documentUrl;
    const base64 = requestPayload.base64;
    const mimeType = requestPayload.document?.mimeType || requestPayload.mimeType;
    const instanceId = requestPayload.instanceId || requestPayload.instanceUrl;

    const safeRequestPayload = {
      phone,
      fileName,
      hasDocumentUrl: !!documentUrl,
      hasBase64: !!base64,
      mimeType,
      instanceId: instanceId?.substring(0, 50),
      type: requestPayload.type,
    };

    console.log(`[wis-api] Received request:`, JSON.stringify(safeRequestPayload));

    if (!phone || !fileName || (!documentUrl && !base64)) {
      const errorMessage = await getErrorMessage(supabase, 'invalid_request');
      const response = { success: false, error_key: 'invalid_request', message: errorMessage };
      await logRequest(supabase, null, phone || '', null, false, 'invalid_request', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    cleanPhone = sanitizePhone(phone);
    console.log(`[wis-api] Processing request for phone: ${cleanPhone}`);

    if (instanceId) {
      const { data: partners } = await supabase
        .from('wis_api_partners')
        .select('id, partner_name, api_url_pattern')
        .eq('is_active', true);

      if (partners && partners.length > 0) {
        for (const partner of partners) {
          const pattern = partner.api_url_pattern.replace(/%/g, '.*');
          const regex = new RegExp(pattern, 'i');
          if (regex.test(instanceId)) {
            partnerId = partner.id;
            console.log(`[wis-api] Partner identified: ${partner.partner_name}`);
            break;
          }
        }
      }

      if (!partnerId) {
        const errorMessage = await getErrorMessage(supabase, 'partner_not_authorized');
        const response = { success: false, error_key: 'partner_not_authorized', message: errorMessage };
        await logRequest(supabase, null, cleanPhone, null, false, 'partner_not_authorized', safeRequestPayload, response);
        return new Response(JSON.stringify(response), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, email')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (!userProfile) {
      const phonesWithCountry = [`55${cleanPhone}`, cleanPhone.replace(/^55/, '')];
      let foundProfile = null;

      for (const phoneVariant of phonesWithCountry) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, email')
          .eq('phone', phoneVariant)
          .maybeSingle();

        if (profile) {
          foundProfile = profile;
          break;
        }
      }

      if (!foundProfile) {
        const errorMessage = await getErrorMessage(supabase, 'user_not_found', { phone: cleanPhone });
        const response = { success: false, error_key: 'user_not_found', message: errorMessage };
        await logRequest(supabase, partnerId, cleanPhone, null, false, 'user_not_found', safeRequestPayload, response);
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = foundProfile.id;
    } else {
      userId = userProfile.id;
    }

    console.log(`[wis-api] User found: ${userId}`);

    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!stripeCustomer) {
      const errorMessage = await getErrorMessage(supabase, 'no_active_subscription');
      const response = { success: false, error_key: 'no_active_subscription', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'no_active_subscription', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscription } = await supabase
      .from('stripe_subscriptions')
      .select('status')
      .eq('customer_id', stripeCustomer.customer_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!subscription) {
      const errorMessage = await getErrorMessage(supabase, 'no_active_subscription');
      const response = { success: false, error_key: 'no_active_subscription', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'no_active_subscription', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wis-api] Active subscription confirmed for user: ${userId}`);

    let fileBlob: Blob;

    if (documentUrl) {
      console.log(`[wis-api] Downloading file from URL...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const fileResponse = await fetch(documentUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!fileResponse.ok) {
          throw new Error(`HTTP ${fileResponse.status}`);
        }

        fileBlob = await fileResponse.blob();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const errorMessage = await getErrorMessage(supabase, 'download_failed');
        const response = { success: false, error_key: 'download_failed', message: errorMessage };
        await logRequest(supabase, partnerId, cleanPhone, userId, false, 'download_failed', safeRequestPayload, response);
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (base64) {
      console.log(`[wis-api] Decoding base64 file...`);
      try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileBlob = new Blob([bytes], { type: mimeType || 'application/pdf' });
      } catch (decodeError) {
        const errorMessage = await getErrorMessage(supabase, 'invalid_request');
        const response = { success: false, error_key: 'invalid_request', message: errorMessage };
        await logRequest(supabase, partnerId, cleanPhone, userId, false, 'invalid_request', safeRequestPayload, response);
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const errorMessage = await getErrorMessage(supabase, 'invalid_request');
      const response = { success: false, error_key: 'invalid_request', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'invalid_request', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveMimeType = mimeType || 'application/pdf';
    const lowerFileName = fileName.toLowerCase();

    if (!lowerFileName.endsWith('.pdf') && effectiveMimeType !== 'application/pdf') {
      const errorMessage = await getErrorMessage(supabase, 'invalid_file_format');
      const response = { success: false, error_key: 'invalid_file_format', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'invalid_file_format', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (fileBlob.size > MAX_FILE_SIZE) {
      const errorMessage = await getErrorMessage(supabase, 'file_too_large');
      const response = { success: false, error_key: 'file_too_large', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'file_too_large', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wis-api] File validated: ${fileBlob.size} bytes`);

    const sanitizedFileName = sanitizeFileName(fileName);
    const timestamp = Date.now();
    const storagePath = `${userId}/${timestamp}-${sanitizedFileName}`;

    console.log(`[wis-api] Uploading to storage: ${storagePath}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('processos')
      .upload(storagePath, fileBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      });

    if (uploadError) {
      console.error(`[wis-api] Upload error:`, uploadError);
      const errorMessage = await getErrorMessage(supabase, 'upload_failed');
      const response = { success: false, error_key: 'upload_failed', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'upload_failed', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from('processos')
      .getPublicUrl(storagePath);

    console.log(`[wis-api] File uploaded successfully`);

    const processoId = crypto.randomUUID();
    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .insert({
        id: processoId,
        file_name: fileName,
        file_path: uploadData.path,
        file_url: publicUrlData.publicUrl,
        file_size: fileBlob.size,
        status: 'created',
        user_id: userId,
        upload_method: 'wis-api',
      })
      .select()
      .single();

    if (processoError) {
      console.error(`[wis-api] Error creating processo:`, processoError);
      const errorMessage = await getErrorMessage(supabase, 'upload_failed');
      const response = { success: false, error_key: 'upload_failed', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'upload_failed', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wis-api] Processo created: ${processoId}`);

    console.log(`[wis-api] Starting analysis...`);
    const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/start-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ processo_id: processoId }),
    });

    if (!analysisResponse.ok) {
      console.error(`[wis-api] Error starting analysis`);
      const errorMessage = await getErrorMessage(supabase, 'analysis_start_failed');
      const response = {
        success: true,
        processo_id: processoId,
        message: errorMessage,
        analysis_started: false,
      };
      await logRequest(supabase, partnerId, cleanPhone, userId, true, 'analysis_start_failed', safeRequestPayload, response);
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wis-api] Analysis started successfully`);

    const successResponse = {
      success: true,
      processo_id: processoId,
      message: 'Arquivo recebido e analise iniciada com sucesso',
      analysis_started: true,
    };

    await logRequest(supabase, partnerId, cleanPhone, userId, true, null, safeRequestPayload, successResponse);

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[wis-api] Unexpected error:', error);

    const errorResponse = {
      success: false,
      error_key: 'upload_failed',
      message: 'Erro ao processar upload do arquivo. Tente novamente em alguns instantes.',
    };

    if (requestPayload) {
      await logRequest(
        supabase,
        partnerId,
        cleanPhone || requestPayload.phone || '',
        userId,
        false,
        'upload_failed',
        { phone: requestPayload.phone, fileName: requestPayload.fileName },
        errorResponse
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
