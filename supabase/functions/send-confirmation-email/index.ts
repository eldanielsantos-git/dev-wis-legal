import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConfirmationEmailRequest {
  user_id: string;
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  phone_country_code?: string;
  city?: string;
  state?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND CONFIRMATION EMAIL - START ===");

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

    const {
      user_id,
      email,
      first_name,
      last_name = "",
      phone = "",
      phone_country_code = "+55",
      city = "",
      state = ""
    }: ConfirmationEmailRequest = await req.json();

    console.log("Request data:", { user_id, email, first_name });

    if (!user_id || !email || !first_name) {
      throw new Error("Missing required fields: user_id, email, first_name");
    }

    console.log("Step 1: Fetching user data from database...");
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, phone, phone_country_code, city, state, avatar_url")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
    }

    const finalFirstName = userProfile?.first_name || first_name;

    console.log("Step 2: Generating email confirmation link (magiclink)...");

    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: 'https://dev-app.wislegal.io/app'
      }
    });

    if (linkError || !linkData) {
      console.error("Failed to generate magic link:", linkError);
      throw new Error(`Failed to generate confirmation link: ${linkError?.message || 'Unknown error'}`);
    }

    const confirmationUrl = linkData.properties.action_link;
    console.log("Magic link generated successfully:", confirmationUrl);

    console.log("Step 3: Sending email via Resend with template...");

    let resendSuccess = false;
    let resendResult: any = null;

    const templateId = "c92753c0-d6e7-427f-a34b-a23cef6c9297";

    const resendPayload: any = {
      from: "WisLegal <noreply@wislegal.io>",
      to: [email],
      template: {
        id: templateId,
        variables: {
          first_name: finalFirstName,
          confirmation_url: confirmationUrl
        }
      }
    };

    console.log("Sending email with template ID:", templateId);
    console.log("Template variables:", { first_name: finalFirstName, confirmation_url: confirmationUrl });

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
    } else {
      resendResult = await resendResponse.json();
      console.log("✓ Email sent successfully via Resend template:", resendResult);
      resendSuccess = true;
    }

    console.log("Step 3.4: Listing all contact properties...");
    const listPropsResponse = await fetch("https://api.resend.com/contact-properties", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
      },
    });

    if (listPropsResponse.ok) {
      const propsList = await listPropsResponse.json();
      console.log("ALL AVAILABLE PROPERTIES:", JSON.stringify(propsList, null, 2));
    } else {
      console.error("Failed to list properties:", await listPropsResponse.text());
    }

    console.log("Step 3.5: Adding contact to Resend Audience...");

    try {
      const audienceId = Deno.env.get("RESEND_AUDIENCE_ID");

      if (!audienceId) {
        console.warn("RESEND_AUDIENCE_ID not set, skipping audience addition");
      } else {
        // TESTE 1: Criar contato SEM propriedades personalizadas
        const basicContactData = {
          email: email,
          firstName: finalFirstName,
          lastName: userProfile?.last_name || last_name || "",
          unsubscribed: false,
          audienceId: audienceId
        };

        console.log("TEST 1: Creating contact WITHOUT custom properties...");
        console.log("Basic contact data:", JSON.stringify(basicContactData, null, 2));

        const basicContactResponse = await fetch("https://api.resend.com/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify(basicContactData),
        });

        const basicResponseText = await basicContactResponse.text();
        console.log("Basic contact response status:", basicContactResponse.status);
        console.log("Basic contact response body:", basicResponseText);

        if (basicContactResponse.ok) {
          const basicResult = JSON.parse(basicResponseText);
          console.log("✓ Basic contact created successfully:", basicResult);

          // TESTE 2: Agora tentar atualizar com propriedades personalizadas
          console.log("TEST 2: Updating contact WITH custom properties...");

          const properties: any = {};
          const phoneCountryCode = userProfile?.phone_country_code || phone_country_code;
          const phoneValue = userProfile?.phone || phone;
          const cityValue = userProfile?.city || city;
          const stateValue = userProfile?.state || state;
          const avatarValue = userProfile?.avatar_url || '';

          if (phoneCountryCode) properties.phone_country_code = phoneCountryCode;
          if (phoneValue) properties.phone = phoneValue;
          if (cityValue) properties.city = cityValue;
          if (stateValue) properties.state = stateValue;
          if (avatarValue) properties.avatar_url = avatarValue;

          console.log("Properties to update:", JSON.stringify(properties, null, 2));

          if (Object.keys(properties).length > 0) {
            const updateData = {
              id: basicResult.id,
              properties: properties
            };

            const updateResponse = await fetch(`https://api.resend.com/contacts/${basicResult.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify(updateData),
            });

            const updateResponseText = await updateResponse.text();
            console.log("Update response status:", updateResponse.status);
            console.log("Update response body:", updateResponseText);

            if (updateResponse.ok) {
              console.log("✓ Contact properties updated successfully");
            } else {
              console.error("Failed to update contact properties:", updateResponseText);
            }
          } else {
            console.log("No custom properties to update");
          }
        } else {
          console.error("Failed to create basic contact:", basicResponseText);
        }
      }
    } catch (audienceError) {
      console.error("Error in contact creation:", audienceError);
      console.error("Stack trace:", audienceError instanceof Error ? audienceError.stack : "No stack");
    }

    console.log("Step 4: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user_id,
        email: email,
        type: "confirmation",
        status: resendSuccess ? "success" : "failed",
        email_provider_response: { resend_id: resendResult?.id || null },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    console.log("=== SEND CONFIRMATION EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email sent successfully via Resend",
        resend_id: resendResult?.id || null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-confirmation-email function:", error);
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