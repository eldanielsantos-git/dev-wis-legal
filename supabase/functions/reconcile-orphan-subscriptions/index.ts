import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: orphanSubscriptions } = await supabase
      .from('stripe_subscriptions')
      .select('customer_id, subscription_id, price_id')
      .is('user_id', null)
      .is('deleted_at', null);

    if (!orphanSubscriptions || orphanSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No orphan subscriptions found',
          summary: {
            total_orphans: 0,
            reconciled: 0,
            no_match: 0,
            errors: 0,
          },
          reconciled: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${orphanSubscriptions.length} orphan subscriptions`);

    let reconciled = 0;
    let noMatch = 0;
    let errors = 0;
    const reconciledDetails: any[] = [];

    for (const orphan of orphanSubscriptions) {
      try {
        const customer = await stripe.customers.retrieve(orphan.customer_id);

        if (!customer || customer.deleted) {
          console.warn(`Customer ${orphan.customer_id} not found or deleted in Stripe`);
          noMatch++;
          continue;
        }

        const email = (customer as any).email;

        if (!email) {
          console.warn(`Customer ${orphan.customer_id} has no email in Stripe`);
          noMatch++;
          continue;
        }

        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', email)
          .limit(1);

        if (!userProfiles || userProfiles.length === 0) {
          console.warn(`No user found with email ${email}`);
          noMatch++;
          continue;
        }

        const userId = userProfiles[0].id;

        const { data: existingCustomer } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingCustomer && existingCustomer.customer_id !== orphan.customer_id) {
          console.warn(`User ${userId} already has a different customer_id: ${existingCustomer.customer_id}`);
          noMatch++;
          continue;
        }

        if (!existingCustomer) {
          const { error: insertError } = await supabase
            .from('stripe_customers')
            .insert({
              user_id: userId,
              customer_id: orphan.customer_id,
              created_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`Error inserting stripe_customer for ${orphan.customer_id}:`, insertError);
            errors++;
            continue;
          }
        }

        const { error: updateError } = await supabase
          .from('stripe_subscriptions')
          .update({ user_id: userId })
          .eq('customer_id', orphan.customer_id)
          .is('user_id', null);

        if (updateError) {
          console.error(`Error updating subscription for ${orphan.customer_id}:`, updateError);
          errors++;
          continue;
        }

        console.log(`Successfully reconciled ${orphan.customer_id} with user ${userId} (${email})`);
        reconciled++;
        reconciledDetails.push({
          customer_id: orphan.customer_id,
          user_id: userId,
          email,
        });
      } catch (err) {
        console.error(`Error processing orphan ${orphan.customer_id}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Reconciliation completed',
        summary: {
          total_orphans: orphanSubscriptions.length,
          reconciled,
          no_match: noMatch,
          errors,
        },
        reconciled: reconciledDetails,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in reconcile-orphan-subscriptions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
