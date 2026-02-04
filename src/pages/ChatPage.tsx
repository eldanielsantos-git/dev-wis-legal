import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { ChatInterface } from '../components/ChatInterface';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Loader, FileText, Calendar } from 'lucide-react';
import { playMessageSendSound, playMessageReceivedSound } from '../utils/notificationSound';

interface Processo {
  id: string;
  file_name: string;
  created_at: string;
  status: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  audio_url?: string;
  audio_duration?: number;
  is_audio?: boolean;
}

interface ChatPageProps {
  processoId?: string;
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToTokens?: () => void;
  onNavigateToSubscription?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function ChatPage({
  processoId,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToTokens,
  onNavigateToSubscription,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: ChatPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { user, isAdmin } = useAuth();

  const [processos, setProcessos] = useState<Processo[]>([]);
  const [selectedProcessoId, setSelectedProcessoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingProcessos, setIsLoadingProcessos] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  useEffect(() => {
    if (user) {
      loadProcessos();
    }
  }, [user]);

  useEffect(() => {
    if (processoId) {
      setSelectedProcessoId(processoId);
    }
  }, [processoId]);

  useEffect(() => {
    if (selectedProcessoId) {
      loadMessages(selectedProcessoId);
      loadProcessoDetails(selectedProcessoId);
    }
  }, [selectedProcessoId]);

  const loadProcessoDetails = async (id: string) => {
    try {
      // RLS já filtra automaticamente (próprios + compartilhados + admin)
      const { data, error } = await supabase
        .from('processos')
        .select('id, file_name, created_at, status')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setProcesso(data);
    } catch (error) {
    }
  };

  const loadProcessos = async () => {
    setIsLoadingProcessos(true);
    try {
      // RLS já filtra automaticamente (próprios + compartilhados + admin)
      const { data, error } = await supabase
        .from('processos')
        .select('id, file_name, created_at, status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProcessos(data || []);

      if (data && data.length > 0 && !selectedProcessoId && !processoId) {
        setSelectedProcessoId(data[0].id);
      }
    } catch (error) {
    } finally {
      setIsLoadingProcessos(false);
    }
  };

  const loadMessages = async (processoId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at, audio_url, audio_duration, is_audio, user_id, processo_id')
        .eq('processo_id', processoId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleAddOptimisticMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleUpdateMessage = (messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    );
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedProcessoId || !user) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSendingMessage(true);

    playMessageSendSound();

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-processo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            processo_id: selectedProcessoId,
            message: content,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to get response from AI');
      }

      const responseData = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseData.response,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      playMessageReceivedSound();
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Desculpe, ocorreu um erro ao processar sua mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSendingMessage(false);
    }
  };


  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToTokens={onNavigateToTokens}
        onNavigateToSubscription={onNavigateToSubscription}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToCookies={onNavigateToCookies}
        onCollapsedChange={setIsSidebarCollapsed}
        activePage="chat"
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out h-screen overflow-hidden`}>
        {!selectedProcessoId ? (
          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
            <section className="mb-6 sm:mb-8">
              <div className="flex items-center justify-center mb-4 gap-3">
                <MessageSquare className="w-8 h-8" style={{ color: colors.textPrimary }} />
                <h1 className="text-3xl sm:text-4xl font-title font-bold" style={{ color: colors.textPrimary }}>Inicie chat</h1>
              </div>
              <p className="text-sm sm:text-base font-body text-center" style={{ color: colors.textSecondary }}>
                Use a ferramenta de chat para tirar dúvidas sobre o seu processo
              </p>
            </section>

            <div>
              <h2 className="text-xl font-bold mb-6 text-center" style={{ color: colors.textPrimary }}>
                Selecione um processo
              </h2>
              {isLoadingProcessos ? (
                <div className="flex flex-wrap justify-center gap-6">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-lg border p-6 animate-pulse w-80"
                      style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
                    >
                      <div className="h-4 rounded" style={{ backgroundColor: colors.border, width: '60%' }}></div>
                      <div className="mt-3 h-3 rounded" style={{ backgroundColor: colors.border, width: '40%' }}></div>
                    </div>
                  ))}
                </div>
              ) : processos.length === 0 ? (
                <div
                  className="rounded-lg border p-12 text-center"
                  style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
                >
                  <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
                  <p style={{ color: colors.textSecondary }}>Nenhum processo encontrado</p>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-6">
                  {processos.map((processo) => (
                    <div
                      key={processo.id}
                      className="rounded-lg border p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] w-80"
                      style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
                      onClick={() => setSelectedProcessoId(processo.id)}
                    >
                      <div className="flex items-start space-x-3 mb-3">
                        <div className="p-2 rounded-lg" style={{
                          backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(41, 50, 58, 0.05)'
                        }}>
                          <FileText className="w-5 h-5" style={{ color: theme === 'dark' ? '#FFFFFF' : '#29323A' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate" style={{ color: colors.textPrimary }}>
                            {processo.file_name}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-xs" style={{ color: colors.textSecondary }}>
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(processo.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        ) : isLoadingMessages || !processo ? (
          <main className="flex-1 flex items-center justify-center">
            <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
          </main>
        ) : (
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
            <ChatInterface
              processoId={selectedProcessoId}
              processoName={processo.file_name}
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isSendingMessage}
              onAddOptimisticMessage={handleAddOptimisticMessage}
              onUpdateMessage={handleUpdateMessage}
              isSidebarCollapsed={isSidebarCollapsed}
              onNavigateToSubscription={onNavigateToSubscription}
              onNavigateToTokens={onNavigateToTokens}
            />
          </main>
        )}
        {!selectedProcessoId && (
          <FooterWis
            onNavigateToTerms={onNavigateToTerms}
            onNavigateToPrivacy={onNavigateToPrivacy}
            onNavigateToCookies={onNavigateToCookies}
          />
        )}
      </div>
    </div>
  );
}
