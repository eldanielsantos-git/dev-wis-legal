import React from 'react';
import { Bug } from 'lucide-react';

interface NotFoundPageProps {
  onNavigateToHome: () => void;
}

export function NotFoundPage({ onNavigateToHome }: NotFoundPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#0F0E0D' }}>
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bug className="w-12 h-12 text-gray-400" />
          </div>

          <h1 className="text-6xl font-bold text-white mb-4">404</h1>

          <h2 className="text-2xl font-semibold text-gray-300 mb-3">
            Ops! esta página não existe mais.
          </h2>

          <p className="text-gray-400 text-base mb-8">
            Ela pode ter sido removida ou mudou a localização.
          </p>
        </div>

        <button
          onClick={onNavigateToHome}
          className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
