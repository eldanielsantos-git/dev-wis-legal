import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileText, Calendar, Clock, CheckCircle, AlertCircle, Loader, Download, Copy, Check, Pencil, Save, ChevronDown, ChevronUp } from 'lucide-react';
import type { Processo, Pagina } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { ProcessosService } from '../services/ProcessosService';
import { ProcessStatusBadge } from '../components/ProcessStatusBadge';
import { ProcessStatusProgress } from '../components/ProcessStatusProgress';
import { ProcessTokenCounter } from '../components/ProcessTokenCounter';
import { useProcessProgressPolling } from '../hooks/useProcessProgressPolling';
import { playCompletionSound, playErrorSound } from '../utils/notificationSound';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface ErrorCardProps {
  title: string;
  message: string;
  type?: 'error' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
  isActionLoading?: boolean;
}

const ErrorCard: React.FC<ErrorCardProps> = ({ title, message, type = 'error', actionLabel, onAction, isActionLoading }) => {
  const isError = type === 'error';
  const bgColor = isError ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = isError ? 'border-red-200' : 'border-yellow-200';
  const iconColor = isError ? 'text-red-600' : 'text-yellow-600';
  const titleColor = isError ? 'text-red-800' : 'text-yellow-800';
  const textColor = isError ? 'text-red-700' : 'text-yellow-700';
  const buttonColor = isError ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-6`}>
      <div className="flex items-start space-x-3">
        <AlertCircle className={`w-6 h-6 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${titleColor} mb-2`}>{title}</h3>
          <p className={`text-sm ${textColor} mb-4`}>{message}</p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              disabled={isActionLoading}
              className={`flex items-center space-x-2 px-4 py-2 ${buttonColor} text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isActionLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <span>{actionLabel}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ProcessoDetailPageProps {
  processoId: string;
  onBack: () => void;
}

export function ProcessoDetailPage({ processoId, onBack }: ProcessoDetailPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedPageId, setCopiedPageId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [paginasCount, setPaginasCount] = useState<number>(0);
  const previousStatusRef = useRef<string | null>(null);

  // Monitor status changes and play completion sound
  useEffect(() => {
    if (processo) {
      const previousStatus = previousStatusRef.current;

      if (previousStatus && previousStatus !== 'completed' && processo.status === 'completed') {
        playCompletionSound();
      }

      previousStatusRef.current = processo.status;
    }
  }, [processo?.status]);

  useProcessProgressPolling({
    processoId,
    status: processo?.status || '',
    onUpdate: (updatedProcesso) => {
      setProcesso(prev => ({
        ...prev,
        ...updatedProcesso
      } as Processo));
    },
    enabled: !!processo && ['queuing', 'processing_batch', 'finalizing', 'processing_forensic'].includes(processo.status)
  });

  useEffect(() => {
    loadProcessoAndPaginas();

    const processoChannel = supabase.channel(`processo-detail-${processoId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'processos', filter: `id=eq.${processoId}` },
        (payload) => {
          console.log('Realtime update for processo:', payload);
          try {
            const updatedProcesso = payload.new as Processo;
            setProcesso(updatedProcesso);
          } catch (err) {
            console.error('Erro ao processar update realtime:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(processoChannel);
    };
  }, [processoId]);


  const loadProcessoAndPaginas = async () => {
    try {
      setLoading(true);
      setError(null);

      const processoData = await ProcessosService.getProcesso(processoId);

      if (!processoData) {
        const { data: fallbackData } = await supabase
          .from('processos')
          .select('*, paginas(*)')
          .eq('id', processoId)
          .single();

        if (!fallbackData) {
          setError('Processo não encontrado no banco de dados');
          return;
        }

        setProcesso(fallbackData as any);
        setPaginas(fallbackData.paginas || []);
        setPaginasCount(fallbackData.paginas?.length || 0);
        setError('Dados carregados com algumas limitações');
        return;
      }

      setProcesso(processoData);

      const paginasData = processoData.paginas || [];
      setPaginas(paginasData);
      setPaginasCount(paginasData.length);

      console.log('[ProcessoDetailPage] Dados carregados:', {
        processoId: processoData.id,
        fileName: processoData.file_name,
        status: processoData.status,
        totalPages: processoData.transcricao?.totalPages,
        paginasCount: paginasData.length,
        hasProcessContent: !!processoData.process_content,
        processContentLength: processoData.process_content?.length || 0
      });
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);

      try {
        const { data: fallbackData } = await supabase
          .from('processos')
          .select('*, paginas(*)')
          .eq('id', processoId)
          .single();

        if (fallbackData) {
          setProcesso(fallbackData as any);
          setPaginas(fallbackData.paginas || []);
          setPaginasCount(fallbackData.paginas?.length || 0);
          setError(`Erro ao processar dados: ${err.message}. Mostrando dados brutos do banco.`);
          playErrorSound();
          return;
        }
      } catch (fallbackErr) {
        console.error('Erro no fallback:', fallbackErr);
      }

      setError(err.message);
      playErrorSound();
    } finally {
      setLoading(false);
    }
  };


  const handleCopyText = async (text: string, pageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPageId(pageId);
      setTimeout(() => setCopiedPageId(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  };

  const handleUpdateName = async () => {
    if (!processo || !editedName.trim() || editedName === processo.file_name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('processos')
        .update({ file_name: editedName.trim() })
        .eq('id', processo.id);

      if (error) throw error;

      setProcesso({ ...processo, file_name: editedName.trim() });
      setIsEditingName(false);
    } catch (err: any) {
      console.error('Erro ao atualizar nome:', err);
      setError('Falha ao atualizar o nome do processo.');
      playErrorSound();
    } finally {
      setIsSavingName(false);
    }
  };

  const handleStartEditing = () => {
    if (!processo) return;
    setEditedName(processo.file_name);
    setIsEditingName(true);
  };

  const handleCancelEditing = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleDownloadText = (text: string, pageNumber: number) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${processo?.file_name}_pagina_${pageNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = () => {
    if (!processo) return null;
    switch (processo.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />;
      default:
        return <Loader className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 animate-spin" />;
    }
  };

  const getStatusText = () => {
    if (!processo) return '';
    switch (processo.status) {
      case 'queuing':
        return 'Na fila';
      case 'transcribing':
        return 'Transcrevendo';
      case 'processing_batch':
        return 'Processando batch';
      case 'completed':
        return 'Concluído';
      case 'error':
        return 'Erro';
      default:
        return processo.status;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const hasValidTranscription = processo &&
    (processo.status === 'completed' || processo.status === 'error') &&
    processo.process_content &&
    processo.process_content.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 flex items-center justify-center">
        <Loader className="w-8 h-8 text-gray-600 animate-spin" />
      </div>
    );
  }

  if (!processo) {
    if (error) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#DC2626' }}>
              <AlertCircle className="w-8 h-8" style={{ color: '#FFFFFF' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-gray-900">
              Processo não encontrado
            </h2>
            <p className="text-base font-normal mb-6 text-gray-700">
              {error}
            </p>
            <button
              onClick={onBack}
              className="px-6 py-2.5 rounded-lg transition-colors border hover:bg-gray-50"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#0F0E0D',
                borderColor: '#E5E7EB'
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  let totalChars = 0;
  try {
    console.log('[ProcessoDetailPage] Calculando totalChars:', {
      paginasLength: paginas?.length || 0,
      processContentLength: processo.process_content?.length || 0,
      paginasData: paginas,
      processContent: processo.process_content
    });

    totalChars = paginas && paginas.length > 0
      ? paginas.reduce((acc, page) => acc + (page.text?.length || 0), 0)
      : (processo.process_content && Array.isArray(processo.process_content)
          ? processo.process_content.reduce((acc, page) => acc + (page.content?.length || 0), 0)
          : 0);

    console.log('[ProcessoDetailPage] totalChars calculado:', totalChars);
  } catch (err) {
    console.error('[ProcessoDetailPage] Erro ao calcular totalChars:', err);
    totalChars = 0;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 overflow-x-hidden w-full">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center space-x-2 sm:space-x-4 group">
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
            </button>
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  {!isEditingName ? (
                    <>
                      <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">{processo.file_name}</h1>
                      <button
                        onClick={handleStartEditing}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0"
                        title="Editar nome"
                      >
                        <Pencil className="w-4 h-4 text-gray-600" />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1 max-w-full">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateName();
                          if (e.key === 'Escape') handleCancelEditing();
                        }}
                        className="flex-1 px-3 py-1.5 text-base sm:text-xl font-bold text-gray-900 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 max-w-full"
                        autoFocus
                      />
                      <button
                        onClick={handleUpdateName}
                        disabled={isSavingName}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                        title="Salvar"
                      >
                        {isSavingName ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEditing}
                        className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors flex-shrink-0"
                        title="Cancelar"
                      >
                        <Check className="w-4 h-4 rotate-45" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
                  <div className="flex-shrink-0">
                    {getStatusIcon()}
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">{getStatusText()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Warning Banner */}
      {error && (
        <div className="mx-3 sm:mx-6 mt-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-semibold text-yellow-800">
                  Aviso: Dados carregados com limitações
                </h3>
                <p className="text-xs text-yellow-700 mt-1">
                  {error}
                </p>
                <p className="text-xs text-yellow-600 mt-2 italic">
                  Os dados exibidos foram recuperados diretamente do banco de dados e podem estar incompletos ou não processados.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="py-3 sm:py-6 overflow-x-hidden w-full">
        {/* Stats Grid */}
        <div className="flex justify-center px-3 sm:px-6 mb-4 sm:mb-6 pt-6 sm:pt-8 w-full">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 w-full max-w-md sm:max-w-2xl lg:max-w-5xl">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0 overflow-hidden">
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-gray-600 mb-1.5 sm:mb-2">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium truncate">Data Upload</span>
            </div>
            <p className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
              {new Date(processo.created_at).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
              {new Date(processo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0 overflow-hidden">
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-gray-600 mb-1.5 sm:mb-2">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium truncate">Páginas</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {processo.transcricao?.totalPages || 0}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
              {formatFileSize(processo.file_size)}
            </p>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0 overflow-hidden">
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-gray-600 mb-1.5 sm:mb-2">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium truncate">Caracteres</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">
              {totalChars.toLocaleString('pt-BR')}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
              Extraídos
            </p>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 min-w-0 overflow-hidden">
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-gray-600 mb-1.5 sm:mb-2">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium truncate">Tempo</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-orange-600">
              {formatDuration(processo.processing_duration_seconds)}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
              {processo.docai_batch_jobs?.length || 1} batches
            </p>
          </div>
          </div>
        </div>

        {/* Token Counter */}
        <div className="px-3 sm:px-6 mb-4 sm:mb-6">
          <div className="max-w-2xl mx-auto">
            <ProcessTokenCounter
              totalPages={processo.transcricao?.totalPages || 0}
              currentPrompt={processo.current_prompt_number || 0}
              totalPrompts={9}
              status={processo.status}
            />
          </div>
        </div>

        {hasValidTranscription && (
          <div className="px-3 sm:px-6 mb-4 sm:mb-6">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowTranscription(!showTranscription)}
                className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Transcrição Completa</h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      {showTranscription ? 'Clique para ocultar' : 'Clique para visualizar'}
                    </p>
                  </div>
                </div>
                {showTranscription ? (
                  <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 flex-shrink-0" />
                )}
              </button>

              {showTranscription && (
                <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
                  <div className="flex items-center justify-end mb-3 gap-2">
                    <button
                      onClick={() => {
                        const fullText = processo.process_content
                          ?.map(page => `--- Página ${page.pagina} ---\n${page.content}`)
                          .join('\n\n') || '';
                        handleCopyText(fullText, 'full-transcription');
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Copiar transcrição completa"
                    >
                      {copiedPageId === 'full-transcription' ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="hidden sm:inline">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="hidden sm:inline">Copiar</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const fullText = processo.process_content
                          ?.map(page => `--- Página ${page.pagina} ---\n${page.content}`)
                          .join('\n\n') || '';
                        const blob = new Blob([fullText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${processo.file_name}_transcricao_completa.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Baixar transcrição completa"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Baixar</span>
                    </button>
                  </div>
                  <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 max-h-96 overflow-y-auto">
                    <div className="space-y-4">
                      {processo.process_content && Array.isArray(processo.process_content) ? (
                        processo.process_content.map((page, index) => {
                          try {
                            return (
                              <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                                <div className="text-xs font-semibold text-blue-600 mb-2">
                                  Página {page?.pagina || index + 1}
                                </div>
                                <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                  {page?.content || '[Conteúdo não disponível]'}
                                </p>
                              </div>
                            );
                          } catch (err) {
                            console.error('[ProcessoDetailPage] Erro ao renderizar página:', err, page);
                            return (
                              <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                                <div className="text-xs font-semibold text-red-600 mb-2">
                                  Erro ao carregar página {index + 1}
                                </div>
                                <p className="text-xs text-red-500">
                                  {String(err)}
                                </p>
                              </div>
                            );
                          }
                        })
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          <p>Conteúdo não disponível ou em formato inválido</p>
                          {processo.process_content && (
                            <p className="text-xs mt-2">Tipo: {typeof processo.process_content}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {processo.status === 'error' && hasValidTranscription && (
          <div className="px-3 sm:px-6 mb-4 sm:mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-yellow-800 mb-1 sm:mb-2">Processo com Status de Erro</h3>
                  <p className="text-xs sm:text-sm text-yellow-700 break-words">
                    Este processo foi marcado com status 'error' mas foi consolidado com sucesso e pode ser analisado. Você pode prosseguir com a análise normalmente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {processo.status === 'error' && !hasValidTranscription && (
          <div className="bg-red-50 border-t border-b border-red-200 p-4 sm:p-6">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-red-800 mb-1 sm:mb-2">Erro no Processamento</h3>
                <p className="text-xs sm:text-sm text-red-700 break-words">
                  {processo.progress_info?.error_message || 'Ocorreu um erro durante o processamento. Verifique os logs para mais detalhes.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {!['completed', 'error'].includes(processo.status) && (
          <div
            className="border-t border-b p-4 sm:p-6"
            style={{
              backgroundColor: theme === 'dark' ? '#1F2937' : '#F9FAFB',
              borderColor: theme === 'dark' ? '#374151' : '#E5E7EB'
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <ProcessStatusBadge
                  status={processo.status}
                  forensicAnalysisStatus={processo.forensic_analysis_status}
                />
              </div>
              <ProcessStatusProgress
                status={processo.status}
                finalizationProgress={processo.finalization_progress_percent}
                progressInfo={processo.progress_info}
              />
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
