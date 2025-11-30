import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHash } from "node:crypto";

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

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const isServiceRole = token === supabaseServiceKey;
    console.log(isServiceRole ? "Service role authenticated" : "Public/User token provided");

    const { user_id, email, first_name, last_name, phone, phone_country_code, city, state }: ConfirmationEmailRequest = await req.json();

    console.log("Request data:", { user_id, email, first_name, last_name, phone, phone_country_code, city, state });

    if (!user_id || !email || !first_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, email, first_name" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Verifying user exists in database...");
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('id, email, last_name, phone, phone_country_code')
      .eq('id', user_id)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error("User not found in database:", profileError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✓ User verified in database");

    console.log("Step 1: Generating confirmation token via Supabase Admin API...");

    // For new users, use generateLink. For existing unconfirmed users, use magic link
    let confirmationUrl = "";
    let confirmationToken = "";

    // Try generateLink first (works for new signups)
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: "signup",
      email: email,
    });

    if (linkError && linkError.message?.includes('already been registered')) {
      console.log("User already registered, generating magic link instead...");

      // User already exists, use magic link instead
      const { data: magicData, error: magicError } = await supabaseClient.auth.admin.generateLink({
        type: "magiclink",
        email: email,
      });

      if (magicError) {
        console.error("Error generating magic link:", magicError);
        throw magicError;
      }

      if (magicData?.properties?.action_link) {
        confirmationToken = new URL(magicData.properties.action_link).searchParams.get("token") || "";
        const baseUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
        confirmationUrl = `${baseUrl}/confirm-email#token=${confirmationToken}&type=magiclink&email=${encodeURIComponent(email)}`;
        console.log("✓ Magic link generated successfully");
      }
    } else if (linkError) {
      console.error("Error generating confirmation link:", linkError);
      throw linkError;
    } else if (linkData?.properties?.action_link) {
      confirmationToken = new URL(linkData.properties.action_link).searchParams.get("token") || "";
      const baseUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
      confirmationUrl = `${baseUrl}/confirm-email#token=${confirmationToken}&type=signup&email=${encodeURIComponent(email)}`;
      console.log("✓ Confirmation token generated successfully");
    } else {
      console.error("No action link generated");
      throw new Error("Failed to generate confirmation link");
    }

    if (!confirmationToken || !confirmationUrl) {
      console.error("Failed to generate confirmation URL");
      throw new Error("Failed to generate confirmation URL");
    }

    console.log("Confirmation URL:", confirmationUrl);

    console.log("Step 2: Adding/Updating subscriber in Mailchimp Audience...");

    const subscriberHash = createHash('md5').update(email.toLowerCase()).digest('hex');

    const addSubscriberUrl = `https://us3.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members/${subscriberHash}`;

    // Get additional user data from database or request
    const finalLastName = last_name || userProfile?.last_name || '';
    const finalPhone = phone || userProfile?.phone || '';
    const finalPhoneCountryCode = phone_country_code || userProfile?.phone_country_code || '';
    const finalCity = city || userProfile?.city || '';
    const finalState = state || userProfile?.state || '';

    const subscriberPayload = {
      email_address: email,
      status_if_new: "subscribed",
      merge_fields: {
        FNAME: first_name,
        LNAME: finalLastName,
        PHONE: finalPhone,
        CTR_CODE: finalPhoneCountryCode,
        CITY: finalCity,
        STATE: finalState,
        CONFIRM: confirmationUrl,
      },
    };

    console.log("Sending to Mailchimp:", JSON.stringify(subscriberPayload, null, 2));

    const addSubscriberResponse = await fetch(addSubscriberUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mailchimpApiKey}`,
      },
      body: JSON.stringify(subscriberPayload),
    });

    if (!addSubscriberResponse.ok) {
      const errorText = await addSubscriberResponse.text();
      console.error("Error adding subscriber to Mailchimp:", addSubscriberResponse.status, errorText);
      throw new Error(`Failed to add subscriber: ${addSubscriberResponse.status} - ${errorText}`);
    }

    const subscriberResult = await addSubscriberResponse.json();
    console.log("✓ Subscriber added/updated in Mailchimp");
    console.log("Subscriber data:", JSON.stringify(subscriberResult, null, 2));

    console.log("Step 3: Triggering Customer Journey...");

    const mailchimpUrl = mailchimpJourneyEndpoint.replace("{step_id}", mailchimpJourneyKey).replace("{subscriber_hash}", subscriberHash);
    console.log("Mailchimp URL:", mailchimpUrl);

    const journeyPayload = {
      email_address: email,
      merge_fields: {
        FNAME: first_name,
        LNAME: finalLastName,
        PHONE: finalPhone,
        CTR_CODE: finalPhoneCountryCode,
        CITY: finalCity,
        STATE: finalState,
        CONFIRM: confirmationUrl,
      },
    };

    console.log("Journey trigger payload:", JSON.stringify(journeyPayload, null, 2));

    const mailchimpResponse = await fetch(mailchimpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mailchimpApiKey}`,
      },
      body: JSON.stringify(journeyPayload),
    });

    if (!mailchimpResponse.ok) {
      const errorText = await mailchimpResponse.text();
      console.error("Mailchimp API error:", mailchimpResponse.status, errorText);
      throw new Error(`Mailchimp API error: ${mailchimpResponse.status} - ${errorText}`);
    }

    let mailchimpResult = { status: mailchimpResponse.status };

    // Customer Journey endpoint returns 204 No Content on success
    if (mailchimpResponse.status !== 204) {
      const contentType = mailchimpResponse.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        mailchimpResult = await mailchimpResponse.json();
      } else {
        mailchimpResult = { status: mailchimpResponse.status, body: await mailchimpResponse.text() };
      }
    }

    console.log("✓ Customer Journey triggered successfully");
    console.log("Mailchimp response:", mailchimpResult);

    console.log("Step 4: Logging email event to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id,
        email,
        type: "confirmation",
        status: "sent",
        mailchimp_response: {
          journey_key: mailchimpJourneyKey,
          subscriber_hash: subscriberHash,
          response: mailchimpResult,
        },
      });

    if (logError) {
      console.error("Error logging email event:", logError);
    } else {
      console.log("✓ Email event logged successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Confirmation email sent successfully",
        email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("💥 Error in send-confirmation-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});