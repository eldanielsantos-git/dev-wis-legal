import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

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

async function md5Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    const mailchimpAudienceId = Deno.env.get("MAILCHIMP_AUDIENCE_ID");
    const mailchimpJourneyEndpoint = Deno.env.get("MAILCHIMP_JOURNEY_ENDPOINT");
    const mailchimpJourneyKey = Deno.env.get("MAILCHIMP_JOURNEY_KEY");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://app.wislegal.io";

    console.log("Environment check:");
    console.log("- SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
    console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓" : "✗");
    console.log("- MAILCHIMP_API_KEY:", mailchimpApiKey ? "✓" : "✗");
    console.log("- MAILCHIMP_AUDIENCE_ID:", mailchimpAudienceId ? "✓" : "✗");
    console.log("- MAILCHIMP_JOURNEY_ENDPOINT:", mailchimpJourneyEndpoint ? "✓" : "✗");
    console.log("- MAILCHIMP_JOURNEY_KEY:", mailchimpJourneyKey ? "✓" : "✗");
    console.log("- FRONTEND_URL:", frontendUrl);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!mailchimpApiKey || !mailchimpAudienceId) {
      throw new Error("Missing Mailchimp environment variables");
    }

    if (!mailchimpJourneyEndpoint || !mailchimpJourneyKey) {
      throw new Error("Missing Mailchimp Journey configuration");
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
    let { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('id, email, last_name, phone, phone_country_code, city, state')
      .eq('id', user_id)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error("User not found in database:", profileError);
      console.log("Attempting to create user profile as fallback...");

      // Get avatar_url from auth.users metadata
      const { data: authUser } = await supabaseClient.auth.admin.getUserById(user_id);
      const avatarUrl = authUser?.user?.user_metadata?.avatar_url;

      if (avatarUrl) {
        console.log("Found avatar_url in auth metadata:", avatarUrl);
      }

      // Fallback: Create user profile if trigger failed
      const { data: createdProfile, error: createError } = await supabaseClient
        .from('user_profiles')
        .insert({
          id: user_id,
          email: email.toLowerCase(),
          first_name: first_name,
          last_name: last_name || '',
          phone: phone || '',
          phone_country_code: phone_country_code || '+55',
          city: city || '',
          state: state || '',
          avatar_url: avatarUrl || null,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create user profile:", createError);
        return new Response(
          JSON.stringify({ 
            error: "User profile not found and could not be created",
            details: createError.message 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      userProfile = createdProfile;
      console.log("✓ User profile created successfully");
    } else {
      console.log("✓ User verified in database");
    }

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
      console.log("✓ Confirmation link generated successfully");
    }

    if (!confirmationUrl || !confirmationToken) {
      throw new Error("Failed to generate confirmation URL");
    }

    console.log("✓ Confirmation URL generated successfully");
    console.log("Confirmation URL (sanitized):", confirmationUrl.replace(confirmationToken, "***TOKEN***"));

    // Use data from user profile if available, otherwise use request data
    const finalLastName = userProfile?.last_name || last_name || '';
    const finalPhone = userProfile?.phone || phone || '';
    const finalPhoneCountryCode = userProfile?.phone_country_code || phone_country_code || '+55';
    const finalCity = userProfile?.city || city || '';
    const finalState = userProfile?.state || state || '';

    console.log("Step 2: Adding/updating subscriber in Mailchimp...");
    const subscriberHash = await md5Hash(email.toLowerCase());
    console.log("Subscriber hash:", subscriberHash);

    const addSubscriberUrl = `https://us3.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members/${subscriberHash}`;

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
        CONFIRMATION_URL: confirmationUrl,
      },
    };

    console.log("Sending to Mailchimp (URL sanitized):", JSON.stringify({
      ...subscriberPayload,
      merge_fields: {
        ...subscriberPayload.merge_fields,
        CONFIRMATION_URL: confirmationUrl.substring(0, 50) + "..." + confirmationUrl.substring(confirmationUrl.length - 20)
      }
    }, null, 2));

    const addSubscriberResponse = await fetch(addSubscriberUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mailchimpApiKey}`,
      },
      body: JSON.stringify(subscriberPayload),
    });

    let mailchimpSuccess = false;

    if (!addSubscriberResponse.ok) {
      const errorText = await addSubscriberResponse.text();
      console.error("Error adding subscriber to Mailchimp:", addSubscriberResponse.status, errorText);

      const isPermanentlyDeleted = errorText.includes("permanently deleted and cannot be re-imported");

      if (isPermanentlyDeleted) {
        console.log("⚠️ Email permanently deleted, attempting to re-add via POST...");

        const readdUrl = `https://us3.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members`;

        const readdPayload = {
          email_address: email,
          status: "subscribed",
          merge_fields: {
            FNAME: first_name,
            LNAME: finalLastName,
            PHONE: finalPhone,
            CTR_CODE: finalPhoneCountryCode,
            CITY: finalCity,
            STATE: finalState,
            CONFIRMATION_URL: confirmationUrl,
          },
        };

        console.log("Attempting to re-add deleted subscriber via POST...");
        console.log("Re-add payload (URL sanitized):", JSON.stringify({
          ...readdPayload,
          merge_fields: {
            ...readdPayload.merge_fields,
            CONFIRMATION_URL: confirmationUrl.substring(0, 50) + "..." + confirmationUrl.substring(confirmationUrl.length - 20)
          }
        }, null, 2));
        const readdResponse = await fetch(readdUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mailchimpApiKey}`,
          },
          body: JSON.stringify(readdPayload),
        });

        if (!readdResponse.ok) {
          const readdError = await readdResponse.text();
          console.error("Failed to re-add deleted subscriber:", readdResponse.status, readdError);
          throw new Error(`Failed to re-add deleted subscriber: ${readdResponse.status} - ${readdError}`);
        }

        const readdResult = await readdResponse.json();
        console.log("✓ Deleted subscriber successfully re-added to Mailchimp");
        console.log("Re-added subscriber data:", JSON.stringify(readdResult, null, 2));
      } else {
        throw new Error(`Failed to add subscriber: ${addSubscriberResponse.status} - ${errorText}`);
      }
    } else {
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
          CONFIRMATION_URL: confirmationUrl,
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
        console.log("⚠️ Customer Journey failed, but continuing...");
      } else {
        let mailchimpResult = { status: mailchimpResponse.status };

        // Customer Journey endpoint returns 204 No Content on success
        if (mailchimpResponse.status !== 204) {
          const contentType = mailchimpResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            mailchimpResult = await mailchimpResponse.json();
          }
        }

        console.log("✓ Customer Journey triggered successfully", mailchimpResult);
        mailchimpSuccess = true;
      }
    }

    console.log("Step 4: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user_id,
        email: email,
        type: "confirmation",
        status: mailchimpSuccess ? "success" : "failed",
        mailchimp_response: { journey_triggered: mailchimpSuccess },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email triggered via Mailchimp Customer Journey",
        confirmation_url: confirmationUrl,
        mailchimp_success: mailchimpSuccess
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
