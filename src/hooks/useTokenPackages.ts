import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TokenPackage {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string;
  checkout_url: string | null;
  price_brl: number;
  tokens_amount: number;
  is_active: boolean;
  display_order: number;
}

const CACHE_KEY = 'token_packages_cache';
const CACHE_DURATION = 5 * 60 * 1000;
const CACHE_VERSION = '2';

export function useTokenPackages() {
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);

      if (cached) {
        const { data, timestamp, version } = JSON.parse(cached);

        if (version === CACHE_VERSION && Date.now() - timestamp < CACHE_DURATION) {
          setPackages(data);
          return true;
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (err) {
      localStorage.removeItem(CACHE_KEY);
    }
    return false;
  };

  const saveToCache = (data: TokenPackage[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION
      }));
    } catch (err) {}
  };

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError(null);

      const hasCachedData = loadFromCache();

      const { data, error: fetchError } = await supabase
        .from('token_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;

      const packagesData = data || [];
      setPackages(packagesData);
      saveToCache(packagesData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pacotes de tokens');
    } finally {
      setLoading(false);
    }
  };

  const refreshPackages = () => {
    localStorage.removeItem(CACHE_KEY);
    fetchPackages();
  };

  useEffect(() => {
    const hasCachedData = loadFromCache();

    if (hasCachedData) {
      setLoading(false);
      fetchPackages();
    } else {
      fetchPackages();
    }

    const packagesChannel = supabase
      .channel('token_packages_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'token_packages'
      }, () => {
        refreshPackages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(packagesChannel);
    };
  }, []);

  return { packages, loading, error, refreshPackages };
}
