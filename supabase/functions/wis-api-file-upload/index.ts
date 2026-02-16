import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

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
  responseSent: Record<string, unknown>,
  processoId?: string | null
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
      processo_id: processoId || null,
    });
  } catch (error) {
    console.error('Error logging request:', error);
  }
}

async function sendWhatsAppNotification(
  supabaseUrl: string,
  supabaseServiceKey: string,
  messageKey: string,
  userId: string,
  phone: string,
  processoId?: string,
  replacements?: Record<string, string>,
  documentBase64?: string,
  documentFilename?: string,
  linkUrl?: string,
  linkTitle?: string,
  linkDescription?: string
): Promise<void> {
  try {
    console.log(`[wis-api] Sending WhatsApp notification: ${messageKey}`);
    await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        message_key: messageKey,
        user_id: userId,
        processo_id: processoId,
        phone,
        replacements,
        document_base64: documentBase64,
        document_filename: documentFilename,
        link_url: linkUrl,
        link_title: linkTitle,
        link_description: linkDescription,
      }),
    });
  } catch (error) {
    console.error(`[wis-api] Error sending WhatsApp notification:`, error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "wis-api-file-upload", version: "2026-02-16-v3" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const { data: recentLog } = await supabase
      .from('wis_api_logs')
      .select('id, created_at, success, error_key')
      .eq('phone_number', cleanPhone)
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentLog) {
      console.log(`[wis-api] Duplicate webhook detected within 60s (previous: ${recentLog.success ? 'success' : recentLog.error_key}), ignoring...`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Request already being processed',
        duplicate_detected: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: userProfiles } = await supabase.rpc('find_user_by_phone', { search_phone: cleanPhone });

    let foundProfile = userProfiles?.[0] || null;

    if (!foundProfile) {
      const phoneWithCountry = `55${cleanPhone}`;
      const { data: profiles2 } = await supabase.rpc('find_user_by_phone', { search_phone: phoneWithCountry });
      foundProfile = profiles2?.[0] || null;
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
      EdgeRuntime.waitUntil(
        sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'no_active_subscription', userId, cleanPhone)
      );
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wis-api] Active subscription confirmed for user: ${userId}`);

    let fileBlob: Blob;

    if (documentUrl) {
      console.log(`[wis-api] Downloading file from URL: ${documentUrl.substring(0, 100)}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      try {
        const fileResponse = await fetch(documentUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        console.log(`[wis-api] Download response status: ${fileResponse.status}`);

        if (!fileResponse.ok) {
          throw new Error(`HTTP ${fileResponse.status}`);
        }

        const contentLength = fileResponse.headers.get('content-length');
        console.log(`[wis-api] Content-Length: ${contentLength || 'unknown'}`);

        fileBlob = await fileResponse.blob();
        console.log(`[wis-api] File downloaded successfully: ${fileBlob.size} bytes`);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const fetchErrorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error(`[wis-api] Download failed:`, fetchErrorMsg);
        const errorMessage = await getErrorMessage(supabase, 'download_failed');
        const response = { success: false, error_key: 'download_failed', message: errorMessage, debug_error: fetchErrorMsg };
        await logRequest(supabase, partnerId, cleanPhone, userId, false, 'download_failed', { ...safeRequestPayload, debug_error: fetchErrorMsg }, response);
        EdgeRuntime.waitUntil(
          sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'download_failed', userId, cleanPhone)
        );
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
      EdgeRuntime.waitUntil(
        sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'invalid_file_format', userId, cleanPhone)
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_FILE_SIZE = 200 * 1024 * 1024;
    if (fileBlob.size > MAX_FILE_SIZE) {
      const errorMessage = await getErrorMessage(supabase, 'file_too_large');
      const response = { success: false, error_key: 'file_too_large', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'file_too_large', safeRequestPayload, response);
      EdgeRuntime.waitUntil(
        sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'file_too_large', userId, cleanPhone)
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const COMPLEX_PAGE_THRESHOLD = 300;
    const MAX_FILE_SIZE_FOR_COMPLEX = 60 * 1024 * 1024;

    let actualPageCount = 0;
    const fileSizeMB = fileBlob.size / (1024 * 1024);

    if (fileSizeMB > 25) {
      actualPageCount = Math.ceil(fileBlob.size / (18 * 1024));
      console.log(`[wis-api] Large file (${fileSizeMB.toFixed(1)}MB) - using estimated page count: ${actualPageCount}`);
    } else {
      try {
        console.log(`[wis-api] Counting PDF pages...`);
        const arrayBuffer = await fileBlob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        actualPageCount = pdfDoc.getPageCount();
        console.log(`[wis-api] PDF has ${actualPageCount} pages`);
      } catch (pdfError) {
        console.error(`[wis-api] Error counting PDF pages:`, pdfError);
        actualPageCount = Math.ceil(fileBlob.size / (18 * 1024));
        console.log(`[wis-api] Using estimated page count: ${actualPageCount}`);
      }
    }

    const isComplexFile = actualPageCount >= COMPLEX_PAGE_THRESHOLD;

    console.log(`[wis-api] File size: ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB, actual pages: ${actualPageCount}, isComplex: ${isComplexFile}`);

    console.log(`[wis-api] File validated: ${fileBlob.size} bytes`);

    const sanitizedFileName = sanitizeFileName(fileName);
    const timestamp = Date.now();
    const storagePath = `${userId}/${timestamp}-${sanitizedFileName}`;

    console.log(`[wis-api] Uploading to storage: ${storagePath} (${(fileBlob.size / 1024 / 1024).toFixed(2)}MB)`);

    let uploadData: { path: string } | null = null;
    let uploadError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[wis-api] Upload attempt ${attempt}/${maxRetries}...`);

        const { data, error } = await supabase.storage
          .from('processos')
          .upload(storagePath, fileBlob, {
            cacheControl: '3600',
            upsert: attempt > 1,
            contentType: 'application/pdf',
          });

        if (error) {
          console.error(`[wis-api] Upload attempt ${attempt} error:`, error);
          uploadError = error as Error;

          if (attempt < maxRetries) {
            const delay = attempt * 2000;
            console.log(`[wis-api] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          uploadData = data;
          uploadError = null;
          console.log(`[wis-api] Upload succeeded on attempt ${attempt}`);
          break;
        }
      } catch (e) {
        console.error(`[wis-api] Upload attempt ${attempt} exception:`, e);
        uploadError = e as Error;

        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          console.log(`[wis-api] Retrying after exception in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (uploadError || !uploadData) {
      console.error(`[wis-api] Upload failed after ${maxRetries} attempts:`, uploadError);
      const errorMessage = await getErrorMessage(supabase, 'upload_failed');
      const response = { success: false, error_key: 'upload_failed', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'upload_failed', safeRequestPayload, response);
      EdgeRuntime.waitUntil(
        sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'upload_failed', userId, cleanPhone)
      );
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from('processos')
      .getPublicUrl(storagePath);

    console.log(`[wis-api] File uploaded successfully`);

    const { data: existingProcesso } = await supabase
      .from('processos')
      .select('id, file_name, created_at')
      .eq('user_id', userId)
      .eq('file_name', fileName)
      .eq('file_size', fileBlob.size)
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .maybeSingle();

    if (existingProcesso) {
      console.log(`[wis-api] Duplicate upload detected, returning existing processo: ${existingProcesso.id}`);
      const duplicateResponse = {
        success: true,
        processo_id: existingProcesso.id,
        message: 'Arquivo já foi recebido e está sendo processado',
        analysis_started: true,
        duplicate_detected: true,
      };
      await logRequest(supabase, partnerId, cleanPhone, userId, true, null, safeRequestPayload, duplicateResponse);
      return new Response(JSON.stringify(duplicateResponse), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const processoId = crypto.randomUUID();

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .insert({
        id: processoId,
        file_name: fileName,
        file_path: uploadData.path,
        file_url: publicUrlData.publicUrl,
        file_size: fileBlob.size,
        status: isComplexFile ? 'pending_chunking' : 'created',
        user_id: userId,
        upload_method: 'wis-api',
        total_pages: actualPageCount,
        is_chunked: isComplexFile,
        original_file_path: isComplexFile ? uploadData.path : null,
      })
      .select()
      .single();

    if (processoError) {
      console.error(`[wis-api] Error creating processo:`, processoError);
      const errorMessage = await getErrorMessage(supabase, 'upload_failed');
      const response = { success: false, error_key: 'upload_failed', message: errorMessage };
      await logRequest(supabase, partnerId, cleanPhone, userId, false, 'upload_failed', safeRequestPayload, response);
      EdgeRuntime.waitUntil(
        sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'upload_failed', userId, cleanPhone)
      );
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wis-api] Processo created: ${processoId}`);

    const sizeInMB = (fileBlob.size / (1024 * 1024)).toFixed(1);
    const complexTag = isComplexFile ? ' | Analise Complexa' : '';
    const uploadNotificationMessage = `${foundProfile.first_name || 'Usuario'} | ${fileName} | ${actualPageCount} pags | ${sizeInMB}MB${complexTag} | Via Wis API WhatsApp`;

    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          type_slug: 'upload_started',
          title: 'Upload Iniciado',
          message: uploadNotificationMessage,
          severity: 'success',
          metadata: {
            user_id: userId,
            user_name: foundProfile.first_name || 'Usuario',
            file_name: fileName,
            file_size: fileBlob.size,
            total_pages: actualPageCount,
            is_complex: isComplexFile,
            upload_method: 'wis-api',
          },
          user_id: userId,
          processo_id: processoId,
        }),
      }).catch((err) => console.error('[wis-api] Error sending admin notification:', err))
    );

    console.log(`[wis-api] Sending file_received notification first...`);
    await sendWhatsAppNotification(
      supabaseUrl,
      supabaseServiceKey,
      'file_received',
      userId,
      cleanPhone,
      processoId,
      { nome: foundProfile.first_name || 'Usuario' }
    );

    if (isComplexFile) {
      console.log(`[wis-api] Complex file detected (${actualPageCount} pages) - starting chunked processing`);

      if (fileBlob.size > MAX_FILE_SIZE_FOR_COMPLEX) {
        console.log(`[wis-api] File too large for complex processing: ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB`);

        await supabase
          .from('processos')
          .update({
            status: 'error',
            last_error_type: `Arquivo muito grande para processamento via API (${(fileBlob.size / 1024 / 1024).toFixed(0)}MB). Maximo: 60MB.`,
          })
          .eq('id', processoId);

        const errorMessage = await getErrorMessage(supabase, 'file_too_large_whatsapp');
        const response = {
          success: false,
          processo_id: processoId,
          error_key: 'file_too_large_whatsapp',
          message: errorMessage || `Arquivo muito grande (${(fileBlob.size / 1024 / 1024).toFixed(0)}MB). Arquivos acima de 60MB devem ser enviados pela interface web.`,
          analysis_started: false,
        };
        await logRequest(supabase, partnerId, cleanPhone, userId, false, 'file_too_large_whatsapp', safeRequestPayload, response, processoId);
        EdgeRuntime.waitUntil(
          sendWhatsAppNotification(
            supabaseUrl,
            supabaseServiceKey,
            'file_too_large_whatsapp',
            userId,
            cleanPhone,
            processoId,
            { size_mb: (fileBlob.size / 1024 / 1024).toFixed(0) }
          )
        );
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[wis-api] Calling split-pdf-chunks...`);
      const splitResponse = await fetch(`${supabaseUrl}/functions/v1/split-pdf-chunks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ processo_id: processoId }),
      });

      if (!splitResponse.ok) {
        const splitError = await splitResponse.text();
        console.error(`[wis-api] Error splitting PDF:`, splitError);

        await supabase
          .from('processos')
          .update({
            status: 'error',
            last_error_type: `Erro ao dividir PDF em partes: ${splitError}`,
          })
          .eq('id', processoId);

        const errorMessage = await getErrorMessage(supabase, 'analysis_start_failed');
        const response = {
          success: false,
          processo_id: processoId,
          error_key: 'analysis_start_failed',
          message: errorMessage,
          analysis_started: false,
        };
        await logRequest(supabase, partnerId, cleanPhone, userId, false, 'analysis_start_failed', safeRequestPayload, response, processoId);
        EdgeRuntime.waitUntil(
          sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'analysis_start_failed', userId, cleanPhone, processoId)
        );
        return new Response(JSON.stringify(response), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const splitResult = await splitResponse.json();
      console.log(`[wis-api] PDF split into ${splitResult.totalChunks} chunks`);

      console.log(`[wis-api] Starting complex analysis...`);
      const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/start-analysis-complex`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ processo_id: processoId }),
      });

      if (!analysisResponse.ok) {
        console.error(`[wis-api] Error starting complex analysis`);
        const errorMessage = await getErrorMessage(supabase, 'analysis_start_failed');
        const response = {
          success: true,
          processo_id: processoId,
          message: errorMessage,
          analysis_started: false,
          is_complex: true,
          total_chunks: splitResult.totalChunks,
        };
        await logRequest(supabase, partnerId, cleanPhone, userId, true, 'analysis_start_failed', safeRequestPayload, response, processoId);
        EdgeRuntime.waitUntil(
          sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'analysis_start_failed', userId, cleanPhone, processoId)
        );
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[wis-api] Complex analysis started successfully`);

      EdgeRuntime.waitUntil(
        sendWhatsAppNotification(
          supabaseUrl,
          supabaseServiceKey,
          'analysis_started',
          userId,
          cleanPhone,
          processoId,
          { nome: foundProfile.first_name || 'Usuario' }
        )
      );

      const successResponse = {
        success: true,
        processo_id: processoId,
        message: `Arquivo com ${actualPageCount} paginas recebido. Analise complexa iniciada com ${splitResult.totalChunks} partes.`,
        analysis_started: true,
        is_complex: true,
        total_pages: actualPageCount,
        total_chunks: splitResult.totalChunks,
      };

      await logRequest(supabase, partnerId, cleanPhone, userId, true, null, safeRequestPayload, successResponse, processoId);

      return new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      await logRequest(supabase, partnerId, cleanPhone, userId, true, 'analysis_start_failed', safeRequestPayload, response, processoId);
      EdgeRuntime.waitUntil(
        sendWhatsAppNotification(supabaseUrl, supabaseServiceKey, 'analysis_start_failed', userId, cleanPhone, processoId)
      );
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

    await logRequest(supabase, partnerId, cleanPhone, userId, true, null, safeRequestPayload, successResponse, processoId);

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[wis-api] CRITICAL Unexpected error:', errorMessage);
    console.error('[wis-api] Error stack:', errorStack);
    console.error('[wis-api] Error type:', error?.constructor?.name);
    console.error('[wis-api] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error || {})));

    const errorResponse = {
      success: false,
      error_key: 'upload_failed',
      message: 'Erro ao processar upload do arquivo. Tente novamente em alguns instantes.',
      debug_error: errorMessage,
    };

    if (requestPayload) {
      await logRequest(
        supabase,
        partnerId,
        cleanPhone || requestPayload.phone || '',
        userId,
        false,
        'upload_failed',
        { phone: requestPayload.phone, fileName: requestPayload.fileName, debug_error: errorMessage, debug_stack: errorStack?.substring(0, 500) },
        errorResponse
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
