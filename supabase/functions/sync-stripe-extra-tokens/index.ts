import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const EXTRA_TOKEN_PRODUCTS: { [key: string]: { tokens: number; name: string } } = {
  'prod_TCZYC41p0xOw3O': { tokens: 1200000, name: '1.2M Tokens' },
  'prod_TCZZzd2SrGSDlD': { tokens: 2000000, name: '2M Tokens' },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting extra tokens sync...');
    console.log('Looking for products:', EXTRA_TOKEN_PRODUCTS);

    console.log('\nDiscovering price IDs from products...');
    const pricesByProduct: { [key: string]: string[] } = {};
    for (const productId of Object.keys(EXTRA_TOKEN_PRODUCTS)) {
      try {
        const prices = await stripe.prices.list({
          product: productId,
          active: true,
        });
        pricesByProduct[productId] = prices.data.map(p => p.id);
        console.log(`Product ${productId}: found prices ${pricesByProduct[productId].join(', ')}`);
      } catch (error: any) {
        console.error(`Error fetching prices for product ${productId}:`, error.message);
      }
    }

    const EXTRA_TOKEN_PRICES: { [key: string]: { tokens: number; name: string; product_id: string } } = {};
    for (const [productId, tokenInfo] of Object.entries(EXTRA_TOKEN_PRODUCTS)) {
      const prices = pricesByProduct[productId] || [];
      for (const priceId of prices) {
        EXTRA_TOKEN_PRICES[priceId] = {
          ...tokenInfo,
          product_id: productId,
        };
      }
    }

    console.log('Price ID to Token mapping:', EXTRA_TOKEN_PRICES);

    const { data: customers, error: customersError } = await supabase
      .from('stripe_customers')
      .select('customer_id, user_id');

    if (customersError) {
      throw customersError;
    }

    const results = {
      total_customers: customers.length,
      customers_with_purchases: 0,
      total_extra_tokens_synced: 0,
      details: [] as any[],
      errors: [] as any[],
    };

    for (const customer of customers) {
      try {
        console.log(`\n=== Processing customer: ${customer.customer_id} ===`);

        let extraTokensTotal = 0;
        const purchases: any[] = [];
        const processedIds = new Set<string>();

        console.log('Fetching checkout sessions...');
        const sessions = await stripe.checkout.sessions.list({
          customer: customer.customer_id,
          limit: 100,
        });

        console.log(`Found ${sessions.data.length} checkout sessions`);

        for (const session of sessions.data) {
          if (session.payment_status === 'paid') {
            console.log(`Processing session ${session.id} - Payment status: ${session.payment_status}`);

            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
              limit: 100,
              expand: ['data.price.product'],
            });

            for (const item of lineItems.data) {
              const priceId = item.price?.id;
              const productId = typeof item.price?.product === 'string' ? item.price.product : undefined;

              console.log(`  Line item - Price: ${priceId}, Product: ${productId}`);

              let tokenInfo = null;
              let matchedBy = '';

              if (priceId && EXTRA_TOKEN_PRICES[priceId]) {
                tokenInfo = EXTRA_TOKEN_PRICES[priceId];
                matchedBy = `price_id: ${priceId}`;
              } else if (productId && EXTRA_TOKEN_PRODUCTS[productId]) {
                tokenInfo = EXTRA_TOKEN_PRODUCTS[productId];
                matchedBy = `product_id: ${productId}`;
              }

              if (tokenInfo) {
                const sessionItemId = `session_${session.id}_${item.id}`;

                if (!processedIds.has(sessionItemId)) {
                  processedIds.add(sessionItemId);
                  const tokensForItem = tokenInfo.tokens * (item.quantity || 1);
                  extraTokensTotal += tokensForItem;

                  purchases.push({
                    session_id: session.id,
                    item_id: item.id,
                    price_id: priceId,
                    product_id: productId || tokenInfo.product_id,
                    matched_by: matchedBy,
                    name: tokenInfo.name,
                    tokens: tokensForItem,
                    amount: (item.amount_total || 0) / 100,
                    quantity: item.quantity || 1,
                    date: new Date((session.created || 0) * 1000).toISOString(),
                  });

                  console.log(`  ✓ MATCH! ${tokensForItem.toLocaleString()} tokens (${matchedBy})`);
                }
              }
            }
          }
        }

        console.log('Fetching invoices...');
        const invoices = await stripe.invoices.list({
          customer: customer.customer_id,
          limit: 100,
        });

        console.log(`Found ${invoices.data.length} invoices`);

        for (const invoice of invoices.data) {
          if (invoice.status === 'paid') {
            console.log(`Processing invoice ${invoice.id} - Status: ${invoice.status}`);

            for (const line of invoice.lines.data) {
              const priceId = line.price?.id;
              const productId = typeof line.price?.product === 'string' ? line.price.product : line.price?.product?.id;

              console.log(`  Line item - Price: ${priceId}, Product: ${productId}, Amount: ${line.amount}`);

              let tokenInfo = null;
              let matchedBy = '';

              if (priceId && EXTRA_TOKEN_PRICES[priceId]) {
                tokenInfo = EXTRA_TOKEN_PRICES[priceId];
                matchedBy = `price_id: ${priceId}`;
              } else if (productId && EXTRA_TOKEN_PRODUCTS[productId]) {
                tokenInfo = EXTRA_TOKEN_PRODUCTS[productId];
                matchedBy = `product_id: ${productId}`;
              }

              if (tokenInfo) {
                const invoiceId = `invoice_${invoice.id}_${line.id}`;

                if (!processedIds.has(invoiceId)) {
                  processedIds.add(invoiceId);
                  const tokensForLine = tokenInfo.tokens * (line.quantity || 1);
                  extraTokensTotal += tokensForLine;

                  purchases.push({
                    invoice_id: invoice.id,
                    line_id: line.id,
                    price_id: priceId,
                    product_id: productId || tokenInfo.product_id,
                    matched_by: matchedBy,
                    name: tokenInfo.name,
                    tokens: tokensForLine,
                    amount: line.amount / 100,
                    quantity: line.quantity || 1,
                    date: new Date(invoice.created * 1000).toISOString(),
                  });

                  console.log(`  ✓ MATCH! ${tokensForLine.toLocaleString()} tokens (${matchedBy})`);
                }
              }
            }
          }
        }

        console.log(`\nTotal for ${customer.customer_id}: ${extraTokensTotal.toLocaleString()} tokens from ${purchases.length} purchases`);

        if (extraTokensTotal > 0) {
          const { data: currentSub } = await supabase
            .from('stripe_subscriptions')
            .select('extra_tokens')
            .eq('customer_id', customer.customer_id)
            .maybeSingle();

          const { error: updateError } = await supabase
            .from('stripe_subscriptions')
            .update({
              extra_tokens: extraTokensTotal,
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', customer.customer_id);

          if (updateError) {
            console.error(`Error updating extra_tokens for ${customer.customer_id}:`, updateError);
            results.errors.push({
              customer_id: customer.customer_id,
              error: updateError.message,
            });
          } else {
            results.customers_with_purchases++;
            results.total_extra_tokens_synced += extraTokensTotal;
            results.details.push({
              customer_id: customer.customer_id,
              previous_extra_tokens: currentSub?.extra_tokens || 0,
              new_extra_tokens: extraTokensTotal,
              purchases: purchases,
            });
            console.log(`✓ Updated database: ${extraTokensTotal.toLocaleString()} extra tokens`);
          }
        } else {
          console.log(`No extra token purchases found for ${customer.customer_id}`);
        }
      } catch (error: any) {
        console.error(`Error processing customer ${customer.customer_id}:`, error);
        results.errors.push({
          customer_id: customer.customer_id,
          error: error.message,
        });
      }
    }

    console.log('\n=== Sync completed ===');
    console.log(`Total customers: ${results.total_customers}`);
    console.log(`Customers with purchases: ${results.customers_with_purchases}`);
    console.log(`Total extra tokens synced: ${results.total_extra_tokens_synced.toLocaleString()}`);
    console.log(`Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({
        message: 'Sincronização de tokens extras concluída',
        summary: {
          total_customers: results.total_customers,
          customers_with_purchases: results.customers_with_purchases,
          total_extra_tokens_synced: results.total_extra_tokens_synced,
          errors: results.errors.length,
        },
        details: results.details,
        errors: results.errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});