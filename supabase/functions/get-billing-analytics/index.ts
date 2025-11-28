import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BillingRequest {
  timePeriod: 'day' | 'week' | 'month' | 'year' | 'all_time';
  dataView: 'all' | 'subscriptions' | 'tokens' | 'canceled';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { timePeriod = 'month', dataView = 'all' }: BillingRequest = await req.json();

    const now = new Date();
    let startDate: Date;
    let endDate = now;
    let granularity: 'hour' | 'day' | 'month' = 'day';

    switch (timePeriod) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        granularity = 'hour';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        granularity = 'day';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        granularity = 'day';
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        granularity = 'month';
        break;
      case 'all_time':
        startDate = new Date('2024-01-01');
        granularity = 'month';
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    const subscriptionMetrics = await fetchSubscriptionMetrics(startTimestamp, endTimestamp);
    const tokenMetrics = await fetchTokenMetrics(startTimestamp, endTimestamp);
    const canceledMetrics = await fetchCanceledMetrics(startTimestamp, endTimestamp);

    const revenueData = generateRevenueData(
      subscriptionMetrics.transactions,
      tokenMetrics.transactions,
      canceledMetrics.transactions,
      startDate,
      endDate,
      granularity
    );

    const previousPeriodRevenue = await calculatePreviousPeriodRevenue(
      startTimestamp,
      timePeriod
    );

    const totalRevenue =
      subscriptionMetrics.totalRevenue +
      tokenMetrics.totalRevenue;

    const revenueGrowth = previousPeriodRevenue > 0
      ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : 0;

    const response = {
      success: true,
      data: {
        timePeriod,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        revenueData,
        subscriptionMetrics: {
          totalRevenue: subscriptionMetrics.totalRevenue,
          activeCount: subscriptionMetrics.activeCount,
          mrr: subscriptionMetrics.mrr,
          averageRevenuePerUser: subscriptionMetrics.averageRevenuePerUser,
          planBreakdown: subscriptionMetrics.planBreakdown,
        },
        tokenMetrics: {
          totalRevenue: tokenMetrics.totalRevenue,
          purchaseCount: tokenMetrics.purchaseCount,
          averagePurchaseValue: tokenMetrics.averagePurchaseValue,
          packageBreakdown: tokenMetrics.packageBreakdown,
          repeatCustomers: tokenMetrics.repeatCustomers,
          firstTimeBuyers: tokenMetrics.firstTimeBuyers,
        },
        canceledMetrics: {
          lostRevenue: canceledMetrics.lostRevenue,
          cancellationCount: canceledMetrics.cancellationCount,
          churnRate: canceledMetrics.churnRate,
          averageTenureDays: canceledMetrics.averageTenureDays,
          canceledByPlan: canceledMetrics.canceledByPlan,
        },
        totalRevenue,
        previousPeriodRevenue,
        revenueGrowth,
        lastUpdated: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Error fetching billing analytics:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch billing analytics',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function fetchSubscriptionMetrics(startTimestamp: number, endTimestamp: number) {
  try {
    const subscriptions: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params = new URLSearchParams({
        limit: '100',
        status: 'all',
      });

      params.append('created[lte]', endTimestamp.toString());

      if (startingAfter) {
        params.append('starting_after', startingAfter);
      }

      const response = await fetch(
        `https://api.stripe.com/v1/subscriptions?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stripe subscription error:', errorText);
        throw new Error(`Stripe API error: ${response.statusText}`);
      }

      const data = await response.json();
      subscriptions.push(...data.data);
      hasMore = data.has_more;
      if (hasMore && data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id;
      }
    }

    const planPrices: Record<string, number> = {
      'price_1SG3zEJrr43cGTt4oUj89h9u': 59.00,
      'price_1SG40ZJrr43cGTt4SGCX0JUZ': 159.00,
      'price_1SG41xJrr43cGTt4MQwqdEiv': 309.00,
      'price_1SG43JJrr43cGTt4URQn0TxZ': 759.00,
    };

    const planNames: Record<string, string> = {
      'price_1SG3zEJrr43cGTt4oUj89h9u': 'Essencial',
      'price_1SG40ZJrr43cGTt4SGCX0JUZ': 'Premium',
      'price_1SG41xJrr43cGTt4MQwqdEiv': 'Pro',
      'price_1SG43JJrr43cGTt4URQn0TxZ': 'Elite',
    };

    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
    const planBreakdownMap: Record<string, any> = {};

    let totalRevenue = 0;
    const transactions: any[] = [];

    for (const sub of activeSubscriptions) {
      const priceId = sub.items.data[0]?.price?.id;

      if (!priceId || !planPrices[priceId]) {
        continue;
      }

      const price = planPrices[priceId];
      const planName = planNames[priceId];

      totalRevenue += price;

      if (!planBreakdownMap[priceId]) {
        planBreakdownMap[priceId] = {
          planName,
          priceId,
          count: 0,
          revenue: 0,
        };
      }

      planBreakdownMap[priceId].count += 1;
      planBreakdownMap[priceId].revenue += price;

      if (sub.created >= startTimestamp && sub.created <= endTimestamp) {
        transactions.push({
          timestamp: sub.created,
          amount: price,
          type: 'subscription',
        });
      } else if (sub.created < startTimestamp && sub.status === 'active') {
        transactions.push({
          timestamp: startTimestamp,
          amount: price,
          type: 'subscription',
        });
      }
    }

    const planBreakdown = Object.values(planBreakdownMap).map((plan: any) => ({
      ...plan,
      percentage: totalRevenue > 0 ? (plan.revenue / totalRevenue) * 100 : 0,
    }));

    const mrr = totalRevenue;
    const averageRevenuePerUser = activeSubscriptions.length > 0
      ? totalRevenue / activeSubscriptions.length
      : 0;

    return {
      totalRevenue,
      activeCount: activeSubscriptions.length,
      mrr,
      averageRevenuePerUser,
      planBreakdown,
      transactions,
    };
  } catch (error) {
    console.error('Error fetching subscription metrics:', error);
    throw error;
  }
}

async function fetchTokenMetrics(startTimestamp: number, endTimestamp: number) {
  try {
    const startDate = new Date(startTimestamp * 1000).toISOString();
    const endDate = new Date(endTimestamp * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from('stripe_orders')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('payment_status', 'paid')
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching token orders:', error);
      throw error;
    }

    const tokenPackages: Record<string, any> = {
      'price_1SGAPJJrr43cGTt4r7k4qYZe': { name: '1.2M Tokens', price: 3800 },
      'price_1SGAQHJrr43cGTt4dKkvB9lD': { name: '2M Tokens', price: 7600 },
    };

    const packageBreakdownMap: Record<string, any> = {};
    let totalRevenue = 0;
    const transactions: any[] = [];
    const customers = new Set();
    const customerPurchaseCounts = new Map<string, number>();

    for (const order of orders || []) {
      const amount = order.amount_total / 100;
      totalRevenue += amount;

      const estimatedPrice = amount.toFixed(2);
      let matchedPackage: string | null = null;

      for (const [priceId, pkg] of Object.entries(tokenPackages)) {
        if (Math.abs((pkg.price / 100) - amount) < 0.5) {
          matchedPackage = priceId;
          break;
        }
      }

      if (matchedPackage) {
        const packageInfo = tokenPackages[matchedPackage];
        if (!packageBreakdownMap[matchedPackage]) {
          packageBreakdownMap[matchedPackage] = {
            packageName: packageInfo.name,
            priceId: matchedPackage,
            count: 0,
            revenue: 0,
          };
        }

        packageBreakdownMap[matchedPackage].count += 1;
        packageBreakdownMap[matchedPackage].revenue += amount;
      }

      const createdTimestamp = Math.floor(new Date(order.created_at).getTime() / 1000);
      transactions.push({
        timestamp: createdTimestamp,
        amount,
        type: 'token',
      });

      customers.add(order.customer_id);
      const currentCount = customerPurchaseCounts.get(order.customer_id) || 0;
      customerPurchaseCounts.set(order.customer_id, currentCount + 1);
    }

    const packageBreakdown = Object.values(packageBreakdownMap).map((pkg: any) => ({
      ...pkg,
      percentage: totalRevenue > 0 ? (pkg.revenue / totalRevenue) * 100 : 0,
    }));

    const purchaseCount = orders?.length || 0;
    const averagePurchaseValue = purchaseCount > 0 ? totalRevenue / purchaseCount : 0;

    let repeatCustomers = 0;
    for (const count of customerPurchaseCounts.values()) {
      if (count > 1) {
        repeatCustomers++;
      }
    }

    const firstTimeBuyers = customers.size - repeatCustomers;

    return {
      totalRevenue,
      purchaseCount,
      averagePurchaseValue,
      packageBreakdown,
      repeatCustomers,
      firstTimeBuyers,
      transactions,
    };
  } catch (error) {
    console.error('Error fetching token metrics:', error);
    throw error;
  }
}

async function fetchCanceledMetrics(startTimestamp: number, endTimestamp: number) {
  try {
    const subscriptions: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params = new URLSearchParams({
        limit: '100',
        status: 'canceled',
      });

      if (startingAfter) {
        params.append('starting_after', startingAfter);
      }

      const response = await fetch(
        `https://api.stripe.com/v1/subscriptions?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stripe canceled subscriptions error:', errorText);
        throw new Error(`Stripe API error: ${response.statusText}`);
      }

      const data = await response.json();
      const filtered = data.data.filter(
        (sub: any) => sub.canceled_at >= startTimestamp && sub.canceled_at <= endTimestamp
      );
      subscriptions.push(...filtered);
      hasMore = data.has_more;
      if (hasMore && data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id;
      }
    }

    const planPrices: Record<string, number> = {
      'price_1SG3zEJrr43cGTt4oUj89h9u': 59.00,
      'price_1SG40ZJrr43cGTt4SGCX0JUZ': 159.00,
      'price_1SG41xJrr43cGTt4MQwqdEiv': 309.00,
      'price_1SG43JJrr43cGTt4URQn0TxZ': 759.00,
    };

    const planNames: Record<string, string> = {
      'price_1SG3zEJrr43cGTt4oUj89h9u': 'Essencial',
      'price_1SG40ZJrr43cGTt4SGCX0JUZ': 'Premium',
      'price_1SG41xJrr43cGTt4MQwqdEiv': 'Pro',
      'price_1SG43JJrr43cGTt4URQn0TxZ': 'Elite',
    };

    let lostRevenue = 0;
    let totalTenureDays = 0;
    const canceledByPlanMap: Record<string, any> = {};
    const transactions: any[] = [];

    for (const sub of subscriptions) {
      const priceId = sub.items.data[0]?.price?.id;

      if (!priceId || !planPrices[priceId]) {
        continue;
      }

      const price = planPrices[priceId];
      const planName = planNames[priceId];

      lostRevenue += price;

      if (!canceledByPlanMap[priceId]) {
        canceledByPlanMap[priceId] = {
          planName,
          priceId,
          count: 0,
          revenue: 0,
        };
      }

      canceledByPlanMap[priceId].count += 1;
      canceledByPlanMap[priceId].revenue += price;

      const tenureDays = Math.floor((sub.canceled_at - sub.created) / (24 * 60 * 60));
      totalTenureDays += tenureDays;

      transactions.push({
        timestamp: sub.canceled_at,
        amount: -price,
        type: 'canceled',
      });
    }

    const canceledByPlan = Object.values(canceledByPlanMap).map((plan: any) => ({
      ...plan,
      percentage: lostRevenue > 0 ? (plan.revenue / lostRevenue) * 100 : 0,
    }));

    const cancellationCount = subscriptions.length;
    const averageTenureDays = cancellationCount > 0 ? totalTenureDays / cancellationCount : 0;

    const { count: totalActiveSubscriptions } = await supabase
      .from('stripe_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null);

    const churnRate = totalActiveSubscriptions && totalActiveSubscriptions > 0
      ? (cancellationCount / totalActiveSubscriptions) * 100
      : 0;

    return {
      lostRevenue,
      cancellationCount,
      churnRate,
      averageTenureDays,
      canceledByPlan,
      transactions,
    };
  } catch (error) {
    console.error('Error fetching canceled metrics:', error);
    throw error;
  }
}

function generateRevenueData(
  subscriptionTransactions: any[],
  tokenTransactions: any[],
  canceledTransactions: any[],
  startDate: Date,
  endDate: Date,
  granularity: 'hour' | 'day' | 'month'
) {
  const allTransactions = [
    ...subscriptionTransactions,
    ...tokenTransactions,
    ...canceledTransactions,
  ];

  const buckets: Record<string, any> = {};

  let current = new Date(startDate);
  while (current <= endDate) {
    const key = formatDateKey(current, granularity);
    buckets[key] = {
      timestamp: current.toISOString(),
      date: key,
      subscriptionRevenue: 0,
      tokenRevenue: 0,
      totalRevenue: 0,
      canceledRevenue: 0,
    };

    switch (granularity) {
      case 'hour':
        current = new Date(current.getTime() + 60 * 60 * 1000);
        break;
      case 'day':
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'month':
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        break;
    }
  }

  for (const transaction of allTransactions) {
    const transactionDate = new Date(transaction.timestamp * 1000);
    const key = formatDateKey(transactionDate, granularity);

    if (buckets[key]) {
      if (transaction.type === 'subscription') {
        buckets[key].subscriptionRevenue += transaction.amount;
      } else if (transaction.type === 'token') {
        buckets[key].tokenRevenue += transaction.amount;
      } else if (transaction.type === 'canceled') {
        buckets[key].canceledRevenue += Math.abs(transaction.amount);
      }
    }
  }

  for (const key in buckets) {
    buckets[key].totalRevenue =
      buckets[key].subscriptionRevenue + buckets[key].tokenRevenue;
  }

  return Object.values(buckets);
}

function formatDateKey(date: Date, granularity: 'hour' | 'day' | 'month'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');

  switch (granularity) {
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`;
    case 'day':
      return `${year}-${month}-${day}`;
    case 'month':
      return `${year}-${month}`;
  }
}

async function calculatePreviousPeriodRevenue(
  startTimestamp: number,
  timePeriod: string
): Promise<number> {
  let previousStartTimestamp: number;
  let previousEndTimestamp = startTimestamp;

  const duration = Math.floor(Date.now() / 1000) - startTimestamp;
  previousStartTimestamp = startTimestamp - duration;

  try {
    const subscriptions = await fetchSubscriptionMetrics(
      previousStartTimestamp,
      previousEndTimestamp
    );
    const tokens = await fetchTokenMetrics(
      previousStartTimestamp,
      previousEndTimestamp
    );

    return subscriptions.totalRevenue + tokens.totalRevenue;
  } catch (error) {
    console.error('Error calculating previous period revenue:', error);
    return 0;
  }
}