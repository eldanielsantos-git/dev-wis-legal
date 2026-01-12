import React, { useState, useEffect } from 'react';
import { Crown, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionInfo {
  product_name: string;
  status: string;
  current_period_end: string;
}

export function UserSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data } = await supabase
          .from('stripe_subscriptions')
          .select('product_name, status, current_period_end')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        setSubscription(data);
      }
    };

    getSubscription();

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(getSubscription);
    return () => authSubscription.unsubscribe();
  }, []);

  if (!user) {
    return null;
  }

  if (!subscription) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600 text-sm">Nenhum plano ativo</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <Crown className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-gray-900">{subscription.product_name}</h3>
      </div>
      
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="w-4 h-4" />
        <span>Renova em {formatDate(subscription.current_period_end)}</span>
      </div>
      
      <div className="mt-2">
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
          subscription.status === 'active' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {subscription.status === 'active' ? 'Ativo' : subscription.status}
        </span>
      </div>
    </div>
  );
}