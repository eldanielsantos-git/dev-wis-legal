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

    console.log("Step 6: Generating complete HTML email...");

    const maxEventsInEmail = 10;

    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const generateEventCardHtml = (event: DeadlineEvent): string => {
      const timeHtml = event.deadline_time
        ? `<tr>
            <td style="padding-bottom: 12px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-right: 16px; width: 120px;">Horário:</td>
                  <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 21px;">${escapeHtml(event.deadline_time)}</td>
                </tr>
              </table>
            </td>
          </tr>`
        : '';

      const categoryHtml = event.category
        ? `<tr>
            <td style="padding-bottom: 12px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-right: 16px; width: 120px;">Categoria:</td>
                  <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 21px;">${escapeHtml(event.category)}</td>
                </tr>
              </table>
            </td>
          </tr>`
        : '';

      const notesHtml = event.notes
        ? `<tr>
            <td style="padding-bottom: 16px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-bottom: 8px;">Observações:</td>
                </tr>
                <tr>
                  <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding: 12px; background-color: #F9FAFB; border-radius: 12px;">${escapeHtml(event.notes)}</td>
                </tr>
              </table>
            </td>
          </tr>`
        : '';

      return `
        <tr>
          <td style="padding-bottom: 24px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 8px;">
              <tr>
                <td style="padding: 24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="color: #1D1C1B; font-family: 'Open Sans', Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 26px; padding-bottom: 16px;">
                        ${escapeHtml(event.processo_name)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-right: 16px; width: 120px;">Assunto:</td>
                            <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 21px;">${escapeHtml(event.subject)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-right: 16px; width: 120px;">Data:</td>
                            <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 21px;">${escapeHtml(event.deadline_date)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ${timeHtml}
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-right: 16px; width: 120px;">Status:</td>
                            <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 21px;">${escapeHtml(event.status_label)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ${categoryHtml}
                    ${notesHtml}
                    <tr>
                      <td align="center" style="padding-top: 8px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="border-radius: 6px; background-color: #1D1C1B;">
                              <a href="${event.view_event_url}" target="_blank" style="background-color: #1D1C1B; border-radius: 6px; color: #ffffff; display: inline-block; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 40px; text-align: center; text-decoration: none; padding: 0 24px; -webkit-text-size-adjust: none;">Ver Processo</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    };

    const eventsToShow = events.slice(0, maxEventsInEmail);
    const eventsHtml = eventsToShow.map(event => generateEventCardHtml(event)).join('');

    console.log(`Generated HTML for ${eventsToShow.length} events`);

    const moreEventsHtml = events.length > maxEventsInEmail
      ? `<tr>
          <td style="padding-bottom: 24px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FEF3C7; border-radius: 8px; border-left: 4px solid #F59E0B;">
              <tr>
                <td style="padding: 16px 20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="color: #92400E; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 21px; padding-bottom: 4px;">
                        Você tem mais eventos hoje!
                      </td>
                    </tr>
                    <tr>
                      <td style="color: #78350F; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px;">
                        Total de ${events.length} eventos agendados. Acesse o calendário para ver todos.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : '';

    const fullHtmlEmail = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Eventos e Prazos do Dia - Wis Legal</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Open Sans', Arial, sans-serif; background-color: #ffffff; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        table { border-collapse: collapse; }
        img { border: 0; display: block; outline: none; text-decoration: none; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
        <tr>
            <td align="center" style="padding: 40px 20px 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/mail_logo_lettering.jpg" alt="Wis Legal" width="180" style="display: block; max-width: 180px; height: auto;">
                        </td>
                    </tr>
                </table>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #FAFAFA; border-radius: 12px;">
                    <tr>
                        <td style="padding: 48px 40px;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; padding-bottom: 16px;">
                                        Olá, <strong>${escapeHtml(firstName)}</strong>!
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; line-height: 24px; padding-bottom: 32px;">
                                        Estou passando aqui para lembrar você sobre sua agenda para o dia de hoje!
                                    </td>
                                </tr>
                                ${eventsHtml}
                                ${moreEventsHtml}
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; line-height: 24px; padding-top: 16px; padding-bottom: 24px;">
                                        Caso você já tenha realizado o evento, não esqueça de atualizar o status no seu calendário. Se já fez isso, desconsidere este email.
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; line-height: 24px; padding-bottom: 24px;">
                                        Se desejar ver sua agenda completa para hoje e para os próximos dias, basta clicar no botão abaixo:
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="center" style="border-radius: 6px; background-color: #1D1C1B;">
                                                    <a href="${viewFullScheduleUrl}" target="_blank" style="background-color: #1D1C1B; border-radius: 6px; color: #ffffff; display: inline-block; font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 48px; text-align: center; text-decoration: none; padding: 0 32px; -webkit-text-size-adjust: none;">Ver Agenda Completa</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
                    <tr>
                        <td style="padding: 32px 0 24px;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-bottom: 8px;">Atenciosamente,</td>
                                </tr>
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; font-weight: 600;">Equipe Wis Legal</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
                    <tr>
                        <td style="padding-top: 24px; border-top: 1px solid #E5E7EB;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 16px;">
                                        <p style="margin: 0; color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 12px; line-height: 18px;">© 2025 Wis Legal. Todos os direitos reservados.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding-bottom: 40px;">
                                        <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/mail_logo_footer.jpg" alt="Wis Legal" width="60" style="display: block; max-width: 60px; height: auto;">
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    const resendPayload = {
      to: [userEmail],
      subject: "Eventos e Prazos do Dia - Wis Legal",
      html: fullHtmlEmail
    };

    console.log("Sending email with complete HTML");
    console.log("Events count:", events.length);
    console.log("HTML email length:", fullHtmlEmail.length, "characters");

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