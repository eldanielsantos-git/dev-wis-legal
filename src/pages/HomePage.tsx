import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '../components/FileUpload';
import { ProcessoCard } from '../components/ProcessoCard';
import { ProcessosService } from '../services/ProcessosService';
import { playCompletionSound } from '../utils/notificationSound';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Brain, Settings, Activity, Search, X } from 'lucide-react';
import type { Processo } from '../lib/supabase';

interface HomePageProps {
  onNavigateToDetail: (processoId: string) => void;
  onNavigateToAdmin: () => void;
}

export function HomePage({ onNavigateToDetail, onNavigateToAdmin }: HomePageProps) {
  const { isAdmin, user } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allProcessos, setAllProcessos] = useState<Processo[]>([]);
  const previousProcessosRef = useRef<Processo[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('[HomePage] useEffect - user:', user?.id);

    if (!user?.id) {
      console.log('[HomePage] Sem usuário, pulando carregamento');
      return;
    }

    loadProcessos();

    const unsubscribe = ProcessosService.subscribeToProcessos(user.id, (updatedProcessos) => {
      console.log('[HomePage] Subscription update:', updatedProcessos?.length || 0);
      setProcessos(updatedProcessos);
      setAllProcessos(updatedProcessos);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    const previousProcessos = previousProcessosRef.current;

    processos.forEach(processo => {
      const previous = previousProcessos.find(p => p.id === processo.id);

      if (previous && previous.status !== 'completed' && processo.status === 'completed') {
        console.log('✅ Processo concluído:', processo.file_name);
        playCompletionSound();
      }
    });

    previousProcessosRef.current = processos;
  }, [processos]);

  const loadProcessos = async () => {
    try {
      console.log('[HomePage] Iniciando carregamento de processos...');
      const data = await ProcessosService.getProcessos();
      console.log('[HomePage] Processos carregados:', data?.length || 0);
      setProcessos(data);
      setAllProcessos(data);
    } catch (err: any) {
      console.error('[HomePage] Erro ao carregar processos:', err);
      console.error('[HomePage] Detalhes do erro:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      });
      // Não mostrar erro se for apenas falta de dados
      if (err?.message && !err?.message.includes('não autenticado')) {
        setError('Erro ao carregar processos. Por favor, recarregue a página.');
      }
    }
  };

  // Busca inteligente com debounce
  useEffect(() => {
    // Limpar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Se não há termo de busca, mostrar todos os processos
    if (!searchTerm || searchTerm.trim().length === 0) {
      setProcessos(allProcessos);
      setIsSearching(false);
      return;
    }

    // Só buscar se tiver pelo menos 2 caracteres
    if (searchTerm.trim().length < 2) {
      setIsSearching(false);
      return;
    }

    // Iniciar busca após 800ms de inatividade (mais tempo para terminar de digitar)
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await ProcessosService.searchProcessos(searchTerm);
        setProcessos(results);
        setIsSearching(false);
      } catch (err) {
        console.error('Erro na busca:', err);
        setIsSearching(false);
      }
    }, 800);

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, allProcessos]);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);
    setProgressMessage(null);
    setProcessingStartTime(Date.now());

    for (const file of files) {
      try {
        if (file.type !== 'application/pdf') {
          throw new Error('Apenas arquivos PDF são permitidos');
        }

        if (file.size > 1024 * 1024 * 1024) {
          throw new Error('Arquivo muito grande (máximo 1GB)');
        }

        await ProcessosService.uploadAndStartProcessing(file, (status) => {
          console.log(`[PROGRESSO]: ${status}`);
          setProgressMessage(status);
        });

      } catch (err: any) {
        console.error('Erro no upload:', err);
        setError(err.message || 'Erro no upload');
        break;
      }
    }

    setLoading(false);
    setProgressMessage(null);
    setProcessingStartTime(undefined);
    await loadProcessos();
  };

  const handleViewDetails = (processo: Processo) => {
    onNavigateToDetail(processo.id);
  };

  const handleDeleteProcesso = async (processo: Processo) => {
    if (!confirm(`Tem certeza que deseja excluir "${processo.file_name}"?`)) {
      return;
    }

    try {
      setError(null);
      await ProcessosService.deleteProcesso(processo.id);
      await loadProcessos();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir processo');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-600 to-[#255886] rounded-lg sm:rounded-xl">
                <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">ARPJ</h1>
              </div>
            </div>
            <button
              onClick={onNavigateToAdmin}
              className="flex items-center space-x-2 p-2 sm:p-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm"
              title="Administração do Sistema"
            >
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="hidden md:inline text-sm font-medium">Admin</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Upload Area */}
        <section className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8 max-w-[600px] mx-auto">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Enviar Novo Documento</h2>
            <p className="text-sm sm:text-base text-gray-600">Faça upload de arquivos PDF para transcrição automática com Document AI</p>
          </div>

          <FileUpload
            onFileSelect={handleFileSelect}
            loading={loading}
            onNavigateToSubscription={() => {
              window.history.pushState({}, '', '/subscription');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          />

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Erro no processamento</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

        </section>

        {/* Processos List */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Documentos Processados</h2>
          <p className="text-sm sm:text-base text-gray-600">Histórico de transcrições e status de processamento</p>
        </div>

        {/* Search Bar */}
        {allProcessos.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite pelo menos 2 caracteres para buscar em todo o conteúdo..."
                className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all text-sm placeholder:text-gray-400 shadow-sm"
              />
              {searchTerm && !isSearching && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Activity className="w-4 h-4 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
            {searchTerm && searchTerm.trim().length === 1 && !isSearching && (
              <div className="mt-2 text-sm text-gray-600">
                <span className="text-gray-500">
                  Digite mais um caractere para iniciar a busca...
                </span>
              </div>
            )}
            {searchTerm && searchTerm.trim().length >= 2 && !isSearching && (
              <div className="mt-2 text-sm text-gray-600">
                {processos.length > 0 ? (
                  <span className="text-green-700 font-medium">
                    ✓ {processos.length} documento(s) encontrado(s) {processos.length !== allProcessos.length && `(de ${allProcessos.length} total)`}
                  </span>
                ) : (
                  <span className="text-red-700 font-medium">
                    Nenhum documento encontrado para "{searchTerm}"
                  </span>
                )}
              </div>
            )}
            {isSearching && (
              <div className="mt-2 text-sm text-blue-600 font-medium">
                🔍 Buscando em todo o conteúdo dos documentos...
              </div>
            )}
          </div>
        )}

        {processos.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="max-w-sm mx-auto">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum documento ainda</h3>
              <p className="text-gray-600 text-sm">
                Faça upload do seu primeiro PDF para começar a transcrição automática
              </p>
            </div>
          </div>
        )}

        {allProcessos.length > 0 && processos.length === 0 && searchTerm && !isSearching && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <div className="max-w-sm mx-auto">
              <div className="p-4 bg-yellow-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Search className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Nenhum resultado encontrado</h3>
              <p className="text-yellow-800 text-sm">
                Não foram encontrados documentos para "{searchTerm}". A busca incluiu nomes de arquivos, status, datas e todo o conteúdo dos documentos.
              </p>
            </div>
          </div>
        )}

        {processos.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {processos.map(processo => {
              const isOwner = user?.id === processo.user_id;
              const canDelete = isAdmin || isOwner;

              return (
                <ProcessoCard
                  key={processo.id}
                  processo={processo}
                  onViewDetails={handleViewDetails}
                  onDelete={canDelete ? handleDeleteProcesso : undefined}
                  isAdmin={isAdmin}
                  userInfo={processo.user_profile ? {
                    name: `${processo.user_profile.first_name} ${processo.user_profile.last_name}`.trim(),
                    email: processo.user_profile.email,
                    created_at: processo.user_profile.created_at
                  } : undefined}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
