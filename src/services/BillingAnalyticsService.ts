import { supabase } from '../lib/supabase';
import type {
  BillingAnalyticsData,
  BillingApiRequest,
  BillingApiResponse,
  BillingDataView,
  TimePeriod,
} from '../types/billing';

class BillingAnalyticsService {
  private cache: Map<string, { data: BillingAnalyticsData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async fetchBillingData(
    timePeriod: TimePeriod,
    dataView: BillingDataView
  ): Promise<BillingAnalyticsData> {
    const cacheKey = `${timePeriod}-${dataView}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const request: BillingApiRequest = {
        timePeriod,
        dataView,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-billing-analytics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch billing data');
      }

      const result: BillingApiResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response from server');
      }

      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      });

      return result.data;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch billing analytics');
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatPercentage(value: number, decimals: number = 1): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  getTimePeriodLabel(period: TimePeriod): string {
    const labels: Record<TimePeriod, string> = {
      day: 'Últimas 24 Horas',
      week: 'Últimos 7 Dias',
      month: 'Últimos 30 Dias',
      year: 'Último Ano',
      all_time: 'Todo o Período',
    };
    return labels[period];
  }

  getDataViewLabel(view: BillingDataView): string {
    const labels: Record<BillingDataView, string> = {
      all: 'Visão Geral',
      subscriptions: 'Apenas Assinaturas',
      tokens: 'Apenas Tokens Extras',
      canceled: 'Assinaturas Canceladas',
    };
    return labels[view];
  }

  formatDateForDisplay(dateString: string, granularity: 'hour' | 'day' | 'month'): string {
    const date = new Date(dateString);

    switch (granularity) {
      case 'hour':
        return date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
      case 'day':
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
        });
      case 'month':
        return date.toLocaleDateString('pt-BR', {
          month: 'short',
          year: 'numeric',
        });
    }
  }

  getGranularityFromPeriod(period: TimePeriod): 'hour' | 'day' | 'month' {
    switch (period) {
      case 'day':
        return 'hour';
      case 'week':
      case 'month':
        return 'day';
      case 'year':
      case 'all_time':
        return 'month';
    }
  }

  calculateTrendColor(value: number): string {
    if (value > 0) return '#10B981';
    if (value < 0) return '#EF4444';
    return '#6B7280';
  }

  exportToCSV(data: BillingAnalyticsData, filename: string = 'billing-data.csv'): void {
    const rows: string[] = [];

    rows.push('Data,Receita Assinaturas,Receita Tokens,Receita Total,Receita Cancelada');

    data.revenueData.forEach(point => {
      rows.push(
        `${point.date},${point.subscriptionRevenue},${point.tokenRevenue},${point.totalRevenue},${point.canceledRevenue || 0}`
      );
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const billingAnalyticsService = new BillingAnalyticsService();
