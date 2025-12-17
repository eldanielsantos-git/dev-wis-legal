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

interface DiagnosticResult {
  email: string;
  database: {
    customer_id: string;
    subscription_id: string | null;
    status: string;
    price_id: string | null;
    tokens_total: number;
    tokens_used: number;
    extra_tokens: number;
  };
  stripe: {
    has_customer: boolean;
    has_subscription: boolean;
    subscription_id?: string;
    status?: string;
    price_id?: string;
    current_period_start?: number;
    current_period_end?: number;
  };
  sync_needed: boolean;
  issues: string[];
}

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

    const { data: customers } = await supabase
      .from('stripe_customers')
      .select(`
        customer_id,
        user_id,
        user_profiles!inner(email)
      `);

    if (!customers || customers.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No customers found',
          total_users: 0,
          users_with_issues: 0,
          diagnostics: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const diagnostics: DiagnosticResult[] = [];

    for (const customer of customers) {
      const customerId = customer.customer_id;
      const email = (customer.user_profiles as any)?.email || 'Unknown';

      const { data: dbSubscription } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .maybeSingle();

      let stripeSubscription = null;
      let hasStripeCustomer = false;

      try {
        await stripe.customers.retrieve(customerId);
        hasStripeCustomer = true;

        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
          status: 'active',
        });

        if (subscriptions.data.length > 0) {
          stripeSubscription = subscriptions.data[0];
        }
      } catch (err) {
        console.error(`Error fetching customer ${customerId} from Stripe:`, err);
      }

      const issues: string[] = [];
      let syncNeeded = false;

      if (!hasStripeCustomer) {
        issues.push('Customer não existe no Stripe');
        syncNeeded = true;
      }

      if (!dbSubscription && stripeSubscription) {
        issues.push('Subscription existe no Stripe mas não no banco');
        syncNeeded = true;
      }

      if (dbSubscription && !stripeSubscription) {
        issues.push('Subscription existe no banco mas não está ativa no Stripe');
        syncNeeded = true;
      }

      if (dbSubscription && stripeSubscription) {
        if (dbSubscription.subscription_id !== stripeSubscription.id) {
          issues.push('Subscription ID divergente entre Stripe e banco');
          syncNeeded = true;
        }

        const stripePriceId = stripeSubscription.items.data[0]?.price?.id;
        if (dbSubscription.price_id !== stripePriceId) {
          issues.push('Price ID divergente entre Stripe e banco');
          syncNeeded = true;
        }

        if (dbSubscription.status !== stripeSubscription.status) {
          issues.push('Status divergente entre Stripe e banco');
          syncNeeded = true;
        }
      }

      if (issues.length > 0 || syncNeeded) {
        diagnostics.push({
          email,
          database: {
            customer_id: customerId,
            subscription_id: dbSubscription?.subscription_id || null,
            status: dbSubscription?.status || 'No subscription',
            price_id: dbSubscription?.price_id || null,
            tokens_total: dbSubscription?.plan_tokens || 0,
            tokens_used: dbSubscription?.tokens_used || 0,
            extra_tokens: dbSubscription?.extra_tokens || 0,
          },
          stripe: {
            has_customer: hasStripeCustomer,
            has_subscription: !!stripeSubscription,
            subscription_id: stripeSubscription?.id,
            status: stripeSubscription?.status,
            price_id: stripeSubscription?.items.data[0]?.price?.id,
            current_period_start: stripeSubscription?.current_period_start,
            current_period_end: stripeSubscription?.current_period_end,
          },
          sync_needed: syncNeeded,
          issues,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Diagnostic completed',
        total_users: customers.length,
        users_with_issues: diagnostics.length,
        diagnostics,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in diagnose-stripe-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});