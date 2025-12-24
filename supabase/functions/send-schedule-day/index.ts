import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScheduleDayEmailRequest {
  user_id?: string;
  date?: string;
}

interface DeadlineEvent {
  processo_name: string;
  subject: string;
  deadline_date: string;
  deadline_time: string;
  status: string;
  status_label: string;
  category: string;
  notes: string;
  view_event_url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND SCHEDULE DAY EMAIL - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, date }: ScheduleDayEmailRequest = await req.json();

    const targetDate = date || new Date().toISOString().split('T')[0];
    console.log("Processing schedule reminders for date:", targetDate);

    if (!user_id) {
      throw new Error("Missing required field: user_id");
    }

    console.log("Step 1: Fetching user profile...");
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error("Error fetching user profile:", profileError);
      throw new Error(`User profile not found for user_id: ${user_id}`);
    }

    console.log("Step 2: Fetching deadlines for the day...");
    const { data: deadlines, error: deadlinesError } = await supabaseClient
      .from("process_deadlines")
      .select("id, processo_id, subject, deadline_date, deadline_time, status, category, notes")
      .eq("user_id", user_id)
      .eq("deadline_date", targetDate)
      .order("deadline_time", { ascending: true });

    if (deadlinesError) {
      console.error("Error fetching deadlines:", deadlinesError);
      throw new Error("Failed to fetch deadlines");
    }

    if (!deadlines || deadlines.length === 0) {
      console.log("No deadlines found for user on this date. Skipping email.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No deadlines found for this date"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${deadlines.length} deadline(s) for user`);

    console.log("Step 3: Fetching processo details for each deadline...");
    const processoIds = [...new Set(deadlines.map(d => d.processo_id))];
    const { data: processos, error: processosError } = await supabaseClient
      .from("processos")
      .select("id, file_name")
      .in("id", processoIds);

    if (processosError) {
      console.error("Error fetching processos:", processosError);
      throw new Error("Failed to fetch processo details");
    }

    const processoMap = new Map(processos?.map(p => [p.id, p.file_name]) || []);

    console.log("Step 4: Preparing email data...");

    const getStatusLabel = (status: string): string => {
      switch (status) {
        case 'pending':
          return 'Pendente';
        case 'completed':
          return 'Concluído';
        case 'expired':
          return 'Atrasado';
        default:
          return status;
      }
    };

    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    const events: DeadlineEvent[] = deadlines.map(deadline => ({
      processo_name: processoMap.get(deadline.processo_id) || 'Processo sem título',
      subject: deadline.subject,
      deadline_date: formatDate(deadline.deadline_date),
      deadline_time: deadline.deadline_time ? deadline.deadline_time.substring(0, 5) : '',
      status: deadline.status,
      status_label: getStatusLabel(deadline.status),
      category: deadline.category || '',
      notes: deadline.notes || '',
      view_event_url: `https://app.wislegal.io/schedule?date=${deadline.deadline_date}&deadline=${deadline.id}`
    }));

    const firstName = userProfile.first_name;
    const userEmail = userProfile.email;
    const viewFullScheduleUrl = "https://app.wislegal.io/schedule";

    console.log("Email details:", {
      to: userEmail,
      first_name: firstName,
      total_events: events.length,
      date: targetDate
    });

    console.log("Step 5: Checking for duplicate emails...");
    const { data: existingEmail, error: emailCheckError } = await supabaseClient
      .from("email_logs")
      .select("id, created_at")
      .eq("type", "schedule_day")
      .eq("user_id", user_id)
      .eq("status", "success")
      .gte("sent_at", `${targetDate}T00:00:00.000Z`)
      .lt("sent_at", `${targetDate}T23:59:59.999Z`)
      .maybeSingle();

    if (emailCheckError) {
      console.error("Error checking for existing email:", emailCheckError);
    }

    if (existingEmail) {
      console.warn(`Email already sent for user ${user_id} on ${targetDate}. Skipping duplicate.`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email already sent for this date",
          existing_email_id: existingEmail.id,
          sent_at: existingEmail.created_at
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Step 6: Building dynamic HTML email...");

    const getStatusColor = (status: string): string => {
      switch (status) {
        case 'expired':
          return '#DC2626';
        case 'completed':
          return '#16A34A';
        case 'pending':
          return '#F59E0B';
        default:
          return '#6B7280';
      }
    };

    const eventCardsHtml = events.map(event => `
      <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">
          ${event.processo_name}
        </h3>

        <div style="margin-bottom: 8px;">
          <span style="font-weight: 600; color: #374151;">Assunto:</span>
          <span style="color: #6B7280; margin-left: 8px;">${event.subject}</span>
        </div>

        <div style="margin-bottom: 8px;">
          <span style="font-weight: 600; color: #374151;">Data:</span>
          <span style="color: #6B7280; margin-left: 8px;">${event.deadline_date}</span>
        </div>

        <div style="margin-bottom: 8px;">
          <span style="font-weight: 600; color: #374151;">Horário:</span>
          <span style="color: #6B7280; margin-left: 8px;">${event.deadline_time}</span>
        </div>

        <div style="margin-bottom: 8px;">
          <span style="font-weight: 600; color: #374151;">Status:</span>
          <span style="color: ${getStatusColor(event.status)}; margin-left: 8px; font-weight: 600;">
            ${event.status_label}
          </span>
        </div>

        ${event.category ? `
        <div style="margin-bottom: 8px;">
          <span style="font-weight: 600; color: #374151;">Categoria:</span>
          <span style="color: #6B7280; margin-left: 8px;">${event.category}</span>
        </div>
        ` : ''}

        ${event.notes ? `
        <div style="margin-bottom: 16px;">
          <span style="font-weight: 600; color: #374151;">Observações:</span>
          <div style="background: white; padding: 12px; margin-top: 8px; border-radius: 4px; color: #6B7280;">
            ${event.notes}
          </div>
        </div>
        ` : ''}

        <a href="${event.view_event_url}"
           style="display: inline-block; background: #111827; color: white; padding: 10px 20px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">
          Ver Processo
        </a>
      </div>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eventos e Prazos do Dia - Wis Legal</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 32px; font-weight: 700; color: #111827; margin: 0;">
        Wís Legal
      </h1>
    </div>

    <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">

      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">
        Olá, ${firstName}!
      </h2>

      <p style="color: #6B7280; line-height: 1.6; margin: 0 0 24px 0;">
        Estou passando aqui para lembrar você sobre sua agenda para o dia de hoje!
      </p>

      ${eventCardsHtml}

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E5E7EB;">
        <a href="${viewFullScheduleUrl}"
           style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          Ver Agenda Completa
        </a>
      </div>

    </div>

    <div style="text-align: center; margin-top: 32px; color: #9CA3AF; font-size: 14px;">
      <p style="margin: 0 0 8px 0;">© 2025 Wis Legal. Todos os direitos reservados.</p>
      <p style="margin: 0;">
        <a href="https://app.wislegal.io" style="color: #2563EB; text-decoration: none;">Acessar Plataforma</a>
      </p>
    </div>

  </div>
</body>
</html>
    `;

    const resendPayload = {
      from: "Wis Legal <no-reply@wislegal.io>",
      to: [userEmail],
      subject: "Eventos e Prazos do Dia - Wis Legal",
      html: htmlContent
    };

    console.log("Sending email with dynamic HTML");
    console.log("Events count:", events.length);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorText);
      throw new Error(`Failed to send email via Resend: ${resendResponse.status} - ${errorText}`);
    }

    const resendResult = await resendResponse.json();
    console.log("✓ Email sent successfully via Resend template:", resendResult);

    console.log("Step 7: Logging email send to database...");
    const { data: logData, error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user_id,
        email: userEmail,
        type: "schedule_day",
        status: "success",
        email_provider_response: {
          resend_id: resendResult.id,
          date: targetDate,
          events_count: events.length
        },
        sent_at: new Date().toISOString()
      })
      .select();

    if (logError) {
      console.error("❌ Failed to log email:", logError);
      console.error("Error details:", JSON.stringify(logError, null, 2));
    } else {
      console.log("✓ Email send logged to database successfully");
      console.log("Log data:", logData);
    }

    console.log("=== SEND SCHEDULE DAY EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Schedule day reminder email sent successfully",
        resend_id: resendResult.id,
        events_count: events.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-schedule-day function:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});