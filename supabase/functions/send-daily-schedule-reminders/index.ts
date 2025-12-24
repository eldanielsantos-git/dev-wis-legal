import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== DAILY SCHEDULE REMINDERS - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const targetDate = new Date().toISOString().split('T')[0];
    console.log("Processing schedule reminders for date:", targetDate);

    console.log("Step 1: Fetching all users with deadlines for today...");
    const { data: deadlines, error: deadlinesError } = await supabaseClient
      .from("process_deadlines")
      .select("user_id")
      .eq("deadline_date", targetDate);

    if (deadlinesError) {
      console.error("Error fetching deadlines:", deadlinesError);
      throw new Error("Failed to fetch deadlines");
    }

    if (!deadlines || deadlines.length === 0) {
      console.log("No deadlines found for today. Exiting.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No deadlines found for today",
          users_processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const uniqueUserIds = [...new Set(deadlines.map(d => d.user_id))];
    console.log(`Found ${uniqueUserIds.length} unique user(s) with deadlines today`);

    const results = {
      total_users: uniqueUserIds.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    console.log("Step 2: Sending individual reminder emails...");
    for (const userId of uniqueUserIds) {
      try {
        console.log(`Processing user: ${userId}`);

        const response = await fetch(`${supabaseUrl}/functions/v1/send-schedule-day`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            date: targetDate
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          results.success++;
          console.log(`✓ Email sent to user ${userId}`);
        } else if (result.message === "Email already sent for this date" || result.message === "No deadlines found for this date") {
          results.skipped++;
          console.log(`⊘ Skipped user ${userId}: ${result.message}`);
        } else {
          results.failed++;
          results.errors.push(`User ${userId}: ${result.error || result.message}`);
          console.error(`✗ Failed to send email to user ${userId}:`, result);
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`User ${userId}: ${errorMsg}`);
        console.error(`✗ Error processing user ${userId}:`, error);
      }
    }

    console.log("=== DAILY SCHEDULE REMINDERS - COMPLETE ===");
    console.log(`Results: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily schedule reminders processing complete",
        date: targetDate,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in daily-schedule-reminders function:", error);
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