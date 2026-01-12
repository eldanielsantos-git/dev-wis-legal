import React from 'react';
import { Check, Zap } from 'lucide-react';
import { StripeProduct } from '../stripe-config';

interface ProductCardProps {
  product: StripeProduct;
  onSelect: (product: StripeProduct) => void;
  loading?: boolean;
  currentPlan?: string;
}

export function ProductCard({ product, onSelect, loading, currentPlan }: ProductCardProps) {
  const isCurrentPlan = currentPlan === product.name;
  const isSubscription = product.mode === 'subscription';
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div className={`relative rounded-lg border-2 p-6 transition-all ${
      isCurrentPlan 
        ? 'border-green-500 bg-green-50' 
        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg'
    }`}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
          Plano Atual
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-4">
        {isSubscription ? (
          <Zap className="w-6 h-6 text-blue-500" />
        ) : (
          <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
            <span className="text-purple-600 text-xs font-bold">T</span>
          </div>
        )}
        <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
      </div>

      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900">
          {formatPrice(product.price)}
        </div>
        <div className="text-sm text-gray-600">
          {isSubscription ? '/mês' : 'pagamento único'}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-gray-600 text-sm leading-relaxed">
          {product.description}
        </p>
      </div>

      {isCurrentPlan ? (
        <div className="flex items-center justify-center gap-2 py-2 text-green-600 font-medium">
          <Check className="w-5 h-5" />
          Ativo
        </div>
      ) : (
        <button
          onClick={() => onSelect(product)}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processando...' : isSubscription ? 'Assinar' : 'Comprar'}
        </button>
      )}
    </div>
  );
}