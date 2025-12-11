import React, { useCallback, useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Loader, Coins, TrendingUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTokenBalance } from '../contexts/TokenBalanceContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import { TokenAvailabilityInfo } from './TokenAvailabilityInfo';
import { TokenValidationService } from '../services/TokenValidationService';
import { TierSystemService, TierName } from '../services/TierSystemService';
import TierBadge from './TierBadge';
import { getPDFPageCount } from '../utils/pdfSplitter';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  loading?: boolean;
  processingStatus?: string;
  onViewProcess?: () => void;
  onNavigateToSubscription?: () => void;
  onNavigateToTokens?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  loading = false,
  processingStatus,
  onViewProcess,
  onNavigateToSubscription,
  onNavigateToTokens
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { tokensRemaining, loading: tokenLoading } = useTokenBalance();
  const subscriptionStatus = useSubscriptionStatus(user?.id);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [estimatedPages, setEstimatedPages] = useState<number>(0);
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);
  const [detectedTier, setDetectedTier] = useState<TierName | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024; // 3 GB

  useEffect(() => {
    const calculateEstimates = async () => {
      if (selectedFiles.length > 0) {
        try {
          let totalPages = 0;
          for (const file of selectedFiles) {
            const pageCount = await getPDFPageCount(file);
            totalPages += pageCount;
          }

          const estimatedTks = TokenValidationService.calculateTokensFromPages(totalPages);
          const tier = TierSystemService.detectTier(totalPages);
          const time = TierSystemService.formatEstimatedTime(totalPages);

          setEstimatedPages(totalPages);
          setEstimatedTokens(estimatedTks);
          setDetectedTier(tier);
          setEstimatedTime(time);
        } catch (error) {
          console.error('Erro ao calcular número de páginas:', error);
          setEstimatedPages(0);
          setEstimatedTokens(0);
          setDetectedTier(null);
          setEstimatedTime('');
        }
      } else {
        setEstimatedPages(0);
        setEstimatedTokens(0);
        setDetectedTier(null);
        setEstimatedTime('');
      }
    };

    calculateEstimates();
  }, [selectedFiles]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMessage('');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);

      // Validar tipo e tamanho
      const invalidType = droppedFiles.find(file => file.type !== 'application/pdf');
      const tooLarge = droppedFiles.find(file => file.size > MAX_FILE_SIZE);

      if (invalidType) {
        setErrorMessage('Apenas arquivos PDF são permitidos');
        return;
      }

      if (tooLarge) {
        setErrorMessage(`Arquivo muito grande! Tamanho máximo: ${formatFileSize(MAX_FILE_SIZE)} (${formatFileSize(tooLarge.size)} enviado)`);
        return;
      }

      const files = droppedFiles.filter(file =>
        file.type === 'application/pdf' && file.size <= MAX_FILE_SIZE
      );

      setSelectedFiles(files);
      if (files.length > 0) {
        onFileSelect(files);
      }
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setErrorMessage('');

    if (e.target.files && e.target.files[0]) {
      const selectedFilesArray = Array.from(e.target.files);

      // Validar tipo e tamanho
      const invalidType = selectedFilesArray.find(file => file.type !== 'application/pdf');
      const tooLarge = selectedFilesArray.find(file => file.size > MAX_FILE_SIZE);

      if (invalidType) {
        setErrorMessage('Apenas arquivos PDF são permitidos');
        return;
      }

      if (tooLarge) {
        setErrorMessage(`Arquivo muito grande! Tamanho máximo: ${formatFileSize(MAX_FILE_SIZE)} (${formatFileSize(tooLarge.size)} enviado)`);
        return;
      }

      const files = selectedFilesArray.filter(file =>
        file.type === 'application/pdf' && file.size <= MAX_FILE_SIZE
      );

      setSelectedFiles(files);
      if (files.length > 0) {
        onFileSelect(files);
      }
    }
  }, [onFileSelect]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusMessage = (status?: string) => {
    switch (status) {
      case 'uploading':
        return 'Preparando upload do arquivo...';
      case 'analyzing':
        return 'Analisando documento...';
      case 'completed':
        return 'Seu processo está pronto!';
      default:
        return 'Processando...';
    }
  };

  if (processingStatus === 'completed' && onViewProcess) {
    return (
      <div className="w-full">
        <div
          className="rounded-lg sm:rounded-xl p-8 text-center"
          style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#FFFFFF' }}
        >
          <div className="flex flex-col items-center space-y-6">
            <div className="p-4 rounded-full" style={{ backgroundColor: '#10B981' }}>
              <FileText className="w-12 h-12 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold mb-2" style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}>
                Seu processo está pronto!
              </p>
              <p className="text-sm" style={{ color: theme === 'dark' ? '#808080' : '#6B7280' }}>
                A análise foi concluída com sucesso
              </p>
            </div>
            <button
              onClick={onViewProcess}
              className="px-6 py-3 rounded-lg font-medium transition-all hover:bg-green-600"
              style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
            >
              Ver Meu Processo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || processingStatus) {
    return (
      <div className="w-full">
        <div
          className="rounded-lg sm:rounded-xl p-8 text-center border"
          style={{
            backgroundColor: theme === 'dark' ? '#141312' : '#FFFFFF',
            borderColor: theme === 'dark' ? 'transparent' : '#E5E7EB'
          }}
        >
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#10B981' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader className="w-6 h-6" style={{ color: '#10B981' }} strokeWidth={1.5} />
              </div>
            </div>
            <div className="w-full max-w-md space-y-6">
              <div>
                <p className="text-xl font-bold mb-2" style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}>
                  {getStatusMessage(processingStatus)}
                </p>
                <p className="text-sm mb-6" style={{ color: theme === 'dark' ? '#808080' : '#6B7280' }}>
                  Aguarde enquanto processamos seu documento, arquivos grandes podem levar alguns minutos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subscriptionStatus.loading) {
    return (
      <div className="w-full">
        <div
          className="rounded-lg sm:rounded-xl p-8 text-center border"
          style={{
            backgroundColor: theme === 'dark' ? '#141312' : '#FFFFFF',
            borderColor: theme === 'dark' ? 'transparent' : '#E5E7EB'
          }}
        >
          <div className="flex flex-col items-center space-y-4">
            <Loader className="w-8 h-8 animate-spin" style={{ color: '#10B981' }} />
            <p className="text-sm" style={{ color: theme === 'dark' ? '#808080' : '#6B7280' }}>
              Verificando assinatura ativa...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calcular tokens disponíveis totais (considera tanto assinatura quanto balance geral)
  const totalAvailableTokens = !tokenLoading
    ? tokensRemaining
    : subscriptionStatus.tokensRemaining;

  if (!subscriptionStatus.hasSubscription && totalAvailableTokens === 0 && !loading && !processingStatus) {
    return (
      <div className="w-full">
        <div
          className="rounded-lg sm:rounded-xl p-8 text-center border"
          style={{
            backgroundColor: theme === 'dark' ? '#141312' : '#FFFFFF',
            borderColor: theme === 'dark' ? '#FAFAFA' : '#FAFAFA'
          }}
        >
          <div className="flex flex-col items-center space-y-6">
            <div className="p-4 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#FAFAFA' : '#1D1C1B' }}>
              <AlertCircle className="w-12 h-12" style={{ color: theme === 'dark' ? '#0F0E0D' : '#FFFFFF' }} />
            </div>
            <div>
              <p className="text-xl font-bold mb-2" style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}>
                Para fazer upload você precisa ter tokens ativos
              </p>
              <p className="text-sm" style={{ color: theme === 'dark' ? '#808080' : '#6B7280' }}>
                Escolha um plano de assinatura para começar a processar documentos
              </p>
            </div>
            <button
              onClick={() => {
                if (onNavigateToSubscription) {
                  onNavigateToSubscription();
                } else {
                  window.history.pushState({}, '', '/signature');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              className="px-6 py-3 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: theme === 'dark' ? '#FAFAFA' : '#0F0E0D',
                color: theme === 'dark' ? '#0F0E0D' : '#FAFAFA'
              }}
            >
              Ver Planos de Assinatura
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 text-center transition-all duration-300 ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".pdf"
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={totalAvailableTokens === 0}
        />

        <div className="flex flex-col items-center space-y-2 sm:space-y-4">
          <div className="p-3 sm:p-4 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#EDEDED' : '#F3F4F6' }}>
            <Upload className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: theme === 'dark' ? '#141312' : '#1F2937' }} />
          </div>

          <div>
            <p className="text-gray-600 text-xs sm:text-sm px-2">
              <span className="hidden sm:inline">Arraste e solte seu arquivo PDF aqui, ou </span>
              <span className="sm:hidden">Toque para </span>
              <span className="hidden sm:inline">clique para </span>selecionar
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2">
              Limite: 200MB • Apenas arquivos PDF
            </p>
            {totalAvailableTokens > 0 && (
              <div className="mt-2">
                <TokenAvailabilityInfo
                  tokensRemaining={totalAvailableTokens}
                  pagesRemaining={Math.round(totalAvailableTokens / 5500)}
                  className="text-gray-500"
                />
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-lg border border-red-300 bg-red-50 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 sm:mt-6 space-y-4">
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2 sm:mb-3">
              Arquivos Selecionados ({selectedFiles.length})
            </h4>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-white border border-gray-200 rounded-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  {file.size > 200 * 1024 * 1024 && (
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Token Estimate Card */}
          <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Coins className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  Estimativa de Consumo
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Páginas estimadas</span>
                    <span className="font-semibold text-blue-900">
                      ~{estimatedPages.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {detectedTier && (
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Tier de Processamento</span>
                      <TierBadge
                        tierName={detectedTier}
                        size="sm"
                        showIcon={true}
                        showLabel={true}
                      />
                    </div>
                  )}
                  {estimatedTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Tempo estimado</span>
                      <span className="font-semibold text-blue-900">
                        {estimatedTime}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Tokens necessários</span>
                    <span className="font-semibold text-blue-900">
                      {TokenValidationService.formatTokenCount(estimatedTokens)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-300">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Seu saldo atual</span>
                      <span className="font-semibold text-blue-900">
                        {TokenValidationService.formatTokenCount(tokensRemaining)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-blue-700">Saldo após análise</span>
                      <span className={`font-semibold ${tokensRemaining - estimatedTokens < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {TokenValidationService.formatTokenCount(Math.max(0, tokensRemaining - estimatedTokens))}
                      </span>
                    </div>
                  </div>
                </div>
                {tokensRemaining < estimatedTokens && (
                  <div className="mt-3">
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      ⚠️ Tokens insuficientes! Você precisará adicionar mais tokens ou reduzir o tamanho do arquivo.
                    </div>
                    {onNavigateToTokens && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={onNavigateToTokens}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: theme === 'dark' ? '#3B82F6' : '#2563EB',
                            color: '#FFFFFF',
                          }}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          Adicionar tokens
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {tokensRemaining >= estimatedTokens && (tokensRemaining - estimatedTokens) < (tokensRemaining * 0.2) && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    💡 Após esta análise, você terá menos de 20% dos seus tokens disponíveis.
                  </div>
                )}
                <p className="text-[10px] text-blue-600 mt-2">
                  * Estimativa baseada em ~5.500 tokens por página. O valor real pode variar.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
