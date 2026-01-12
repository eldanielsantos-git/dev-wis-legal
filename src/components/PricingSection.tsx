import React, { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import { getTokenProducts, getSubscriptionProducts, StripeProduct } from '../stripe-config';
import { supabase } from '../lib/supabase';

export function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('');
  const [user, setUser] = useState<any>(null);

  const subscriptionProducts = getSubscriptionProducts();
  const tokenProducts = getTokenProducts();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data: subscription } = await supabase
          .from('stripe_subscriptions')
          .select('product_name')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (subscription) {
          setCurrentPlan(subscription.product_name);
        }
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(getUser);
    return () => subscription.unsubscribe();
  }, []);

  const handleProductSelect = async (product: StripeProduct) => {
    if (!user) {
      alert('Faça login para continuar');
      return;
    }

    setLoading(product.id);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: product.priceId,
          mode: product.mode
        })
      });

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Erro ao processar checkout:', error);
      alert('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Subscription Plans */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Planos de Assinatura</h2>
          <p className="text-lg text-gray-600">Escolha o plano ideal para suas necessidades jurídicas</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {subscriptionProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={handleProductSelect}
              loading={loading === product.id}
              currentPlan={currentPlan}
            />
          ))}
        </div>
      </div>

      {/* Token Packages */}
      <div>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Pacotes de Tokens</h2>
          <p className="text-lg text-gray-600">Compre tokens adicionais conforme necessário</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {tokenProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={handleProductSelect}
              loading={loading === product.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}