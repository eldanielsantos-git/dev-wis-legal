export type BillingDataView = 'all' | 'subscriptions' | 'tokens' | 'canceled';

export type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all_time';

export interface RevenueDataPoint {
  timestamp: string;
  date: string;
  subscriptionRevenue: number;
  tokenRevenue: number;
  totalRevenue: number;
  canceledRevenue?: number;
}

export interface SubscriptionMetrics {
  totalRevenue: number;
  activeCount: number;
  mrr: number;
  averageRevenuePerUser: number;
  planBreakdown: PlanBreakdown[];
}

export interface PlanBreakdown {
  planName: string;
  priceId: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface TokenPurchaseMetrics {
  totalRevenue: number;
  purchaseCount: number;
  averagePurchaseValue: number;
  packageBreakdown: TokenPackageBreakdown[];
  repeatCustomers: number;
  firstTimeBuyers: number;
}

export interface TokenPackageBreakdown {
  packageName: string;
  priceId: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface CanceledSubscriptionMetrics {
  lostRevenue: number;
  cancellationCount: number;
  churnRate: number;
  averageTenureDays: number;
  canceledByPlan: PlanBreakdown[];
}

export interface BillingAnalyticsData {
  timePeriod: TimePeriod;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  revenueData: RevenueDataPoint[];
  subscriptionMetrics: SubscriptionMetrics;
  tokenMetrics: TokenPurchaseMetrics;
  canceledMetrics: CanceledSubscriptionMetrics;
  totalRevenue: number;
  previousPeriodRevenue: number;
  revenueGrowth: number;
  lastUpdated: string;
}

export interface BillingApiRequest {
  timePeriod: TimePeriod;
  dataView: BillingDataView;
  startDate?: string;
  endDate?: string;
}

export interface BillingApiResponse {
  success: boolean;
  data?: BillingAnalyticsData;
  error?: string;
  message?: string;
}
