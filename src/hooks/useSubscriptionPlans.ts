import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  stripe_price_id: string;
  price_brl: number;
  tokens_included: number;
  is_active: boolean;
  display_order: number;
}

interface PlanBenefit {
  id: string;
  plan_id: string;
  benefit_text: string;
  is_active: boolean;
  display_order: number;
}

const CACHE_KEY = 'subscription_plans_cache';
const BENEFITS_CACHE_KEY = 'plan_benefits_cache';
const CACHE_DURATION = 5 * 60 * 1000;

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [benefits, setBenefits] = useState<Record<string, PlanBenefit[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedBenefits = localStorage.getItem(BENEFITS_CACHE_KEY);

      if (cached && cachedBenefits) {
        const { data, timestamp } = JSON.parse(cached);
        const { data: benefitsData, timestamp: benefitsTimestamp } = JSON.parse(cachedBenefits);

        if (Date.now() - timestamp < CACHE_DURATION && Date.now() - benefitsTimestamp < CACHE_DURATION) {
          setPlans(data);
          setBenefits(benefitsData);
          return true;
        }
      }
    } catch (err) {}
    return false;
  };

  const saveToCache = (plansData: SubscriptionPlan[], benefitsData: Record<string, PlanBenefit[]>) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: plansData,
        timestamp: Date.now()
      }));
      localStorage.setItem(BENEFITS_CACHE_KEY, JSON.stringify({
        data: benefitsData,
        timestamp: Date.now()
      }));
    } catch (err) {}
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const hasCachedData = loadFromCache();

      const [plansResponse, benefitsResponse] = await Promise.all([
        supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('subscription_plan_benefits')
          .select('*')
          .eq('is_active', true)
          .order('plan_id, display_order', { ascending: true })
      ]);

      if (plansResponse.error) {
        throw plansResponse.error;
      }
      if (benefitsResponse.error) {
        throw benefitsResponse.error;
      }

      const plansData = plansResponse.data || [];
      const benefitsData = benefitsResponse.data || [];

      // Group benefits by plan_id
      const benefitsByPlan: Record<string, PlanBenefit[]> = {};
      benefitsData.forEach((benefit: any) => {
        if (!benefitsByPlan[benefit.plan_id]) {
          benefitsByPlan[benefit.plan_id] = [];
        }
        benefitsByPlan[benefit.plan_id].push(benefit);
      });

      setPlans(plansData);
      setBenefits(benefitsByPlan);
      saveToCache(plansData, benefitsByPlan);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const refreshPlans = () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(BENEFITS_CACHE_KEY);
    fetchPlans();
  };

  useEffect(() => {
    const hasCachedData = loadFromCache();

    if (hasCachedData) {
      setLoading(false);
      fetchPlans();
    } else {
      fetchPlans();
    }

    const plansChannel = supabase
      .channel('subscription_plans_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscription_plans'
      }, () => {
        refreshPlans();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscription_plan_benefits'
      }, () => {
        refreshPlans();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(plansChannel);
    };
  }, []);

  return { plans, benefits, loading, error, refreshPlans };
}
