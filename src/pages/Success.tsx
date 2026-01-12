import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getProductByPriceId } from '../stripe-config';

export function Success() {
  const [searchParams] = useSearchParams();
  const [product, setProduct] = useState<any>(null);
  
  const sessionId = searchParams.get('session_id');
  const priceId = searchParams.get('price_id');

  useEffect(() => {
    if (priceId) {
      const foundProduct = getProductByPriceId(priceId);
      setProduct(foundProduct);
    }
  }, [priceId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pagamento Realizado com Sucesso!
          </h1>
          <p className="text-gray-600">
            Obrigado pela sua compra. Seu {product?.mode === 'subscription' ? 'plano' : 'pacote'} foi ativado.
          </p>
        </div>

        {product && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
            <p className="text-sm text-gray-600">{product.description}</p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            ID da Sessão: {sessionId}
          </p>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
}