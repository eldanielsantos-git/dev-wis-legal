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
}

Deno.serve(async (req: Request) => {
  console.log("🚀 send-confirmation-email function called");
  console.log("Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mailchimpApiKey = Deno.env.get("MAILCHIMP_API_KEY");
    const mailchimpJourneyKey = Deno.env.get("MAILCHIMP_JOURNEY_KEY");
    const mailchimpJourneyEndpoint = Deno.env.get("MAILCHIMP_JOURNEY_ENDPOINT");
    const mailchimpAudienceId = Deno.env.get("MAILCHIMP_AUDIENCE_ID");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || Deno.env.get("VITE_APP_URL") || "https://app.wislegal.io";

    console.log("Environment check:");
    console.log("- SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
    console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓" : "✗");
    console.log("- MAILCHIMP_API_KEY:", mailchimpApiKey ? "✓" : "✗");
    console.log("- MAILCHIMP_JOURNEY_KEY:", mailchimpJourneyKey ? "✓" : "✗");
    console.log("- MAILCHIMP_JOURNEY_ENDPOINT:", mailchimpJourneyEndpoint ? "✓" : "✗");
    console.log("- MAILCHIMP_AUDIENCE_ID:", mailchimpAudienceId ? "✓" : "✗");
    console.log("- FRONTEND_URL:", frontendUrl);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!mailchimpApiKey || !mailchimpJourneyKey || !mailchimpJourneyEndpoint || !mailchimpAudienceId) {
      throw new Error("Missing Mailchimp environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("User verification error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("User verified:", user.id, user.email);

    const { user_id, email, first_name }: ConfirmationEmailRequest = await req.json();

    console.log("Request data:", { user_id, email, first_name });

    if (!user_id || !email || !first_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, email, first_name" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Step 1: Generating confirmation token via Supabase Admin API...");
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `${frontendUrl}/confirm-email`,
      }
    });

    if (linkError || !linkData) {
      console.error("Error generating confirmation link:", linkError);
      throw new Error("Failed to generate confirmation link");
    }

    const confirmationUrl = linkData.properties?.action_link || '';
    console.log("✓ Confirmation URL generated:", confirmationUrl.substring(0, 50) + "...");

    console.log("Step 2: Adding contact to Mailchimp audience...");
    const mailchimpListUrl = `https://us3.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members`;

    const mailchimpMemberData = {
      email_address: email,
      status: "subscribed",
      merge_fields: {
        FNAME: first_name,
        CONFIRM_STATUS: "pendente"
      }
    };

    console.log("Mailchimp member data:", mailchimpMemberData);

    const addMemberResponse = await fetch(mailchimpListUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mailchimpApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mailchimpMemberData),
    });

    if (!addMemberResponse.ok) {
      const errorText = await addMemberResponse.text();
      console.log("Mailchimp add member response:", addMemberResponse.status, errorText);

      if (addMemberResponse.status === 400 && errorText.includes("already exists")) {
        console.log("Member already exists, updating instead...");

        const emailHash = await crypto.subtle.digest(
          "MD5",
          new TextEncoder().encode(email.toLowerCase())
        );
        const hashArray = Array.from(new Uint8Array(emailHash));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const updateUrl = `https://us3.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members/${hashHex}`;
        const updateResponse = await fetch(updateUrl, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${mailchimpApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mailchimpMemberData),
        });

        if (!updateResponse.ok) {
          const updateError = await updateResponse.text();
          console.error("Failed to update existing member:", updateError);
        } else {
          console.log("✓ Member updated successfully");
        }
      } else {
        console.error("Failed to add member to Mailchimp:", errorText);
      }
    } else {
      const memberData = await addMemberResponse.json();
      console.log("✓ Member added to Mailchimp:", memberData.id);
    }

    console.log("Step 3: Triggering Mailchimp Journey...");
    const journeyPayload = {
      email_address: email,
      properties: {
        FNAME: first_name,
        EMAIL: email,
        CONFIRMATION_URL: confirmationUrl
      }
    };

    console.log("Journey payload:", journeyPayload);

    const journeyResponse = await fetch(mailchimpJourneyEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mailchimpJourneyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(journeyPayload),
    });

    console.log("Journey API response status:", journeyResponse.status);

    if (!journeyResponse.ok) {
      const errorText = await journeyResponse.text();
      console.error("Failed to trigger Mailchimp Journey:", errorText);
      throw new Error(`Mailchimp Journey API error: ${journeyResponse.status}`);
    }

    console.log("✓ Mailchimp Journey triggered successfully");

    console.log("Step 4: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user_id,
        email: email,
        type: "confirmation",
        status: "sent",
        mailchimp_response: {
          journey_triggered: true,
          member_added: true
        },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email send:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email sent successfully via Mailchimp"
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
