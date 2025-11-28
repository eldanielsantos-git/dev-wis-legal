import React from 'react';
import { Coins, FileText } from 'lucide-react';
import { TokenValidationService } from '../services/TokenValidationService';

interface ProcessTokenCounterProps {
  totalPages: number;
  currentPrompt?: number;
  totalPrompts?: number;
  status?: string;
  className?: string;
}

export const ProcessTokenCounter: React.FC<ProcessTokenCounterProps> = ({
  totalPages,
  currentPrompt = 0,
  totalPrompts = 9,
  status = 'analyzing',
  className = ''
}) => {
  const tokensPerPage = 5500;
  const estimatedTotalTokens = totalPages * tokensPerPage;
  const progressPercent = totalPrompts > 0 ? (currentPrompt / totalPrompts) * 100 : 0;

  const formatTokens = (tokens: number): string => {
    return TokenValidationService.formatTokenCount(tokens);
  };

  const formatNumber = (num: number): string => {
    return TokenValidationService.formatNumber(num);
  };

  const getStatusColor = () => {
    if (status === 'completed') return 'text-green-600';
    if (status === 'error') return 'text-red-600';
    return 'text-blue-600';
  };

  const getStatusBgColor = () => {
    if (status === 'completed') return 'bg-green-50 border-green-200';
    if (status === 'error') return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getStatusText = () => {
    if (status === 'completed') return 'Tokens debitados com sucesso';
    if (status === 'error') return 'Erro no processamento';
    return 'Processando e calculando tokens';
  };

  return (
    <div className={`rounded-lg border p-4 ${getStatusBgColor()} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Coins className={`w-5 h-5 ${getStatusColor()}`} />
          <h4 className={`font-semibold ${getStatusColor()}`}>
            Consumo de Tokens
          </h4>
        </div>
        {status === 'analyzing' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Em andamento</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Total de páginas</span>
          </div>
          <span className="font-semibold text-gray-900">
            {formatNumber(totalPages)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Tokens estimados</span>
          <span className="font-semibold text-gray-900">
            {formatTokens(estimatedTotalTokens)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Cálculo</span>
          <span className="text-xs text-gray-500">
            {formatNumber(totalPages)} × {formatTokens(tokensPerPage)} = {formatTokens(estimatedTotalTokens)}
          </span>
        </div>

        {status === 'analyzing' && currentPrompt > 0 && (
          <>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Progresso da análise</span>
                <span className="font-medium text-blue-600">
                  {currentPrompt} de {totalPrompts} etapas
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </>
        )}

        {status === 'completed' && (
          <div className="pt-2 border-t border-green-200">
            <p className="text-sm text-green-700 font-medium">
              ✓ {getStatusText()}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {formatTokens(estimatedTotalTokens)} tokens foram debitados da sua conta
            </p>
          </div>
        )}

        {status === 'analyzing' && (
          <div className="pt-2 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              {getStatusText()}... Os tokens serão debitados quando a análise for concluída.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
