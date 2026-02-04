import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Clock, FileText, Loader2 } from 'lucide-react';
import { TokenReservationService } from '../services/TokenReservationService';

interface ProcessingInProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  availableTokens: number;
  requiredTokens: number;
  reservedTokens: number;
  onNavigateToProcess?: (processoId: string) => void;
  onNavigateToTokens?: () => void;
}

interface ProcessWithReservation {
  id: string;
  tokens_reserved: number;
  expires_at: string;
  created_at: string;
  processos?: {
    id: string;
    numero_processo: string;
    nome_cliente: string;
    status: string;
  };
}

export const ProcessingInProgressModal: React.FC<ProcessingInProgressModalProps> = ({
  isOpen,
  onClose,
  userId,
  availableTokens,
  requiredTokens,
  reservedTokens,
  onNavigateToProcess,
  onNavigateToTokens,
}) => {
  const [processes, setProcesses] = useState<ProcessWithReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      loadProcesses();
    }
  }, [isOpen, userId]);

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const data = await TokenReservationService.getProcessesWithActiveReservations(userId);
      setProcesses(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const formatExpiresIn = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `Expira em ${hours}h ${minutes % 60}min`;
    }
    return `Expira em ${minutes}min`;
  };

  const handleViewProcess = (processoId: string) => {
    if (onNavigateToProcess) {
      onClose();
      onNavigateToProcess(processoId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Análise em Andamento
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mensagem explicativa */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Você tem análises em andamento que estão usando tokens temporariamente.
              Aguarde a conclusão ou cancele uma análise para liberar tokens.
            </p>
          </div>

          {/* Informações de tokens */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo Total</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {(availableTokens + reservedTokens).toLocaleString()}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">Reservados</p>
              <p className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                {reservedTokens.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-xs text-green-700 dark:text-green-400 mb-1">Disponíveis</p>
              <p className="text-lg font-semibold text-green-900 dark:text-green-200">
                {availableTokens.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Lista de processos em andamento */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Análises em Andamento
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : processes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma análise em andamento encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processes.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => item.processos && handleViewProcess(item.processos.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white mb-1">
                          {item.processos?.numero_processo || 'Processo sem número'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {item.processos?.nome_cliente || 'Cliente não informado'}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                        {item.processos?.status || 'Processando'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{item.tokens_reserved.toLocaleString()} tokens reservados</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatExpiresIn(item.expires_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Informação sobre necessidade */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Tokens necessários:</strong> {requiredTokens.toLocaleString()}
              <br />
              <strong>Faltam:</strong> {(requiredTokens - availableTokens).toLocaleString()} tokens
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {onNavigateToTokens && (
            <button
              onClick={() => {
                onClose();
                onNavigateToTokens();
              }}
              className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Comprar Tokens
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors ml-auto"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
