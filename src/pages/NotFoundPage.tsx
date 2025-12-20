import React from 'react';
import { Home, AlertCircle } from 'lucide-react';

interface NotFoundPageProps {
  onNavigateToHome: () => void;
}

export function NotFoundPage({ onNavigateToHome }: NotFoundPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#0F0E0D' }}>
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-12 h-12 text-gray-400" />
          </div>

          <h1 className="text-6xl font-bold text-white mb-4">404</h1>

          <h2 className="text-2xl font-semibold text-gray-300 mb-3">
            Página não encontrada
          </h2>

          <p className="text-gray-400 text-base mb-8">
            A página que você está procurando não existe ou foi removida.
          </p>
        </div>

        <button
          onClick={onNavigateToHome}
          className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium"
        >
          <Home className="w-5 h-5" />
          Voltar para a página inicial
        </button>
      </div>
    </div>
  );
}
