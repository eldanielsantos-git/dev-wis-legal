import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorCardProps {
  type: 'parse' | 'structure' | 'validation';
  message?: string;
  details?: string;
  rawContent?: string;
}

export function ErrorCard({ type, message, details, rawContent }: ErrorCardProps) {
  if (type === 'parse') {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">
              Erro ao processar análise
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">
              {message || 'Não foi possível fazer o parse do JSON.'}
            </p>
          </div>
        </div>
        {rawContent && (
          <pre className="mt-2 text-xs bg-red-100 dark:bg-red-950 p-2 rounded overflow-auto max-h-40 text-red-900 dark:text-red-200">
            {rawContent.substring(0, 300)}...
          </pre>
        )}
      </div>
    );
  }

  if (type === 'structure') {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-2">
              Estrutura inválida
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {message || 'A estrutura dos dados não corresponde ao formato esperado.'}
            </p>
            {details && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                {details}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/50 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-orange-800 dark:text-orange-200 font-semibold mb-2">
            {message || 'Erro de validação'}
          </p>
          {details && (
            <p className="text-orange-700 dark:text-orange-300 text-sm">{details}</p>
          )}
        </div>
      </div>
    </div>
  );
}
