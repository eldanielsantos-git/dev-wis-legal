import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, FileText, Mic, ChevronLeft, Lightbulb } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessageUser } from './ChatMessageUser';
import { ChatMessageAssistant } from './ChatMessageAssistant';
import { ChatLoadingDots } from './LoadingSpinner';
import { AudioRecordingAnimation } from './AudioRecordingAnimation';
import { ChatTokenCounter } from './ChatTokenCounter';
import { NoTokensModal } from './NoTokensModal';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { supabase } from '../lib/supabase';
import { playMessageSendSound, playMessageReceivedSound } from '../utils/notificationSound';
import { useTokenBalance } from '../contexts/TokenBalanceContext';
import { ChatIntroPromptsService, type ChatIntroPrompt } from '../services/ChatIntroPromptsService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  audio_url?: string;
  audio_duration?: number;
  is_audio?: boolean;
  feedback_chat?: 'like' | 'dislike' | null;
}

interface ChatInterfaceProps {
  processoId: string | null;
  processoName: string;
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  onAddOptimisticMessage?: (message: Message) => void;
  onUpdateMessage?: (messageId: string, updates: Partial<Message>) => void;
  isSidebarCollapsed?: boolean;
  onNavigateToSubscription?: () => void;
  onNavigateToTokens?: () => void;
}

export function ChatInterface({ processoId, processoName, messages, onSendMessage, isLoading, onAddOptimisticMessage, onUpdateMessage, isSidebarCollapsed = true, onNavigateToSubscription, onNavigateToTokens }: ChatInterfaceProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { profile } = useAuth();
  const { tokensRemaining, refreshBalance } = useTokenBalance();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showPromptTips, setShowPromptTips] = useState(false);
  const [showNoTokensModal, setShowNoTokensModal] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const [chatIntroPrompts, setChatIntroPrompts] = useState<ChatIntroPrompt[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const avatarUrl = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/avatar-ai.svg';

  const audioRecorder = useAudioRecorder();

  useEffect(() => {
    loadChatIntroPrompts();

    const subscription = ChatIntroPromptsService.subscribeToChanges(() => {
      loadChatIntroPrompts();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadChatIntroPrompts = async () => {
    try {
      const prompts = await ChatIntroPromptsService.getActivePrompts();
      setChatIntroPrompts(prompts);
    } catch (error) {
      console.error('Error loading chat intro prompts:', error);
    }
  };

  const scrollToBottom = (instant = false) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? 'auto' : 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    });
  };

  useEffect(() => {
    setIsInitialLoad(true);
    setPreviousMessageCount(0);
  }, [processoId]);

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad) {
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
        setIsInitialLoad(false);
        setPreviousMessageCount(messages.length);
      } else {
        scrollToBottom(false);
      }
    }
  }, [messages, isInitialLoad]);

  useEffect(() => {
    console.log('[ChatInterface] Profile avatar_url:', profile?.avatar_url);
  }, [profile]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending || !processoId) return;

    // Verificar se tem tokens disponíveis
    if (tokensRemaining <= 0) {
      setShowNoTokensModal(true);
      return;
    }

    const messageToSend = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    playMessageSendSound();

    try {
      await onSendMessage(messageToSend);
      playMessageReceivedSound();

      // Atualiza o saldo múltiplas vezes para garantir captura do débito
      setTimeout(() => refreshBalance(), 500);
      setTimeout(() => refreshBalance(), 2000);
      setTimeout(() => refreshBalance(), 4000);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputValue(messageToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleMicClick = async () => {
    if (audioRecorder.isRecording) {
      return;
    }
    await audioRecorder.startRecording();
  };

  const handleCancelRecording = () => {
    audioRecorder.cancelRecording();
  };

  const handleStopRecording = async () => {
    if (!processoId) return;

    // Verificar se tem tokens disponíveis
    if (tokensRemaining <= 0) {
      audioRecorder.cancelRecording();
      setShowNoTokensModal(true);
      return;
    }

    setIsSending(true);
    playMessageSendSound();

    try {
      console.log('[ChatInterface] Stopping audio recording...');
      const audioBlob = await audioRecorder.stopRecording();

      if (!audioBlob) {
        throw new Error('Não foi possível obter o áudio gravado');
      }

      console.log('[ChatInterface] Audio blob details:', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: audioRecorder.recordingTime
      });

      if (audioBlob.size === 0) {
        throw new Error('Áudio vazio. Tente gravar novamente.');
      }

      if (audioBlob.size > 10 * 1024 * 1024) {
        throw new Error('Áudio muito grande. Limite: 10MB');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const tempMessageId = `temp-${Date.now()}`;

      const optimisticMessage: Message = {
        id: tempMessageId,
        role: 'user',
        content: '',
        created_at: new Date().toISOString(),
        audio_url: audioUrl,
        audio_duration: audioRecorder.recordingTime,
        is_audio: true,
      };

      if (onAddOptimisticMessage) {
        console.log('[ChatInterface] Adding optimistic audio message to timeline');
        onAddOptimisticMessage(optimisticMessage);
      }

      setIsProcessingAudio(true);

      console.log('[ChatInterface] Converting audio to base64...');
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          console.log('[ChatInterface] Base64 length:', base64.length);
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      console.log('[ChatInterface] Getting session...');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      console.log('[ChatInterface] Sending audio to edge function...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-audio-message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            processo_id: processoId,
            audio_data: audioBase64,
            audio_duration: audioRecorder.recordingTime
          }),
        }
      );

      console.log('[ChatInterface] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ChatInterface] Edge function error response:', errorData);
        const errorMessage = errorData.details || errorData.error || 'Failed to process audio';
        const stack = errorData.stack ? `\n\nStack:\n${errorData.stack}` : '';
        throw new Error(errorMessage + stack);
      }

      const responseData = await response.json();
      console.log('[ChatInterface] Audio processed successfully:', responseData);

      if (onUpdateMessage && responseData.transcription) {
        console.log('[ChatInterface] Updating user message with transcription and audio URL');
        onUpdateMessage(tempMessageId, {
          content: responseData.transcription,
          audio_url: responseData.audio_url || audioUrl,
        });
      }

      if (responseData.response && onAddOptimisticMessage) {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseData.response,
          created_at: new Date().toISOString(),
        };

        console.log('[ChatInterface] Adding assistant response to timeline');
        onAddOptimisticMessage(assistantMessage);
      }

      playMessageReceivedSound();

      // Atualiza o saldo múltiplas vezes para garantir captura do débito
      setTimeout(() => refreshBalance(), 500);
      setTimeout(() => refreshBalance(), 2000);
      setTimeout(() => refreshBalance(), 4000);

    } catch (error) {
      console.error('[ChatInterface] Error processing audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      alert(`Erro ao processar áudio:\n\n${errorMessage}\n\nVerifique o console para mais detalhes.`);
    } finally {
      setIsSending(false);
      setIsProcessingAudio(false);
    }
  };

  if (!processoId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
        <FileText className="w-16 h-16 mb-4" style={{ color: colors.textSecondary }} />
        <h2 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
          Selecione um processo
        </h2>
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          Escolha um processo da lista ao lado para começar a conversa
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div
        className={`flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 left-0 right-0 z-40 ${isSidebarCollapsed ? '' : ''}`}
        style={{
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.bgPrimary
        }}>
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 w-full max-w-[1280px] mx-auto">
          <button
            onClick={() => window.history.back()}
            className="flex items-center space-x-1.5 sm:space-x-2 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg transition-colors hover:bg-opacity-80 flex-shrink-0"
            style={{
              color: colors.textSecondary,
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bgSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Voltar</span>
          </button>
          <div className="h-5 sm:h-6 w-px flex-shrink-0" style={{ backgroundColor: colors.border }}></div>
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: theme === 'dark' ? '#FFFFFF' : '#141312' }} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-sm font-semibold truncate" style={{ color: colors.textPrimary }}>
              {processoName}
            </h2>
            <p className="text-[10px] sm:text-xs truncate" style={{ color: colors.textSecondary }}>
              Faça perguntas sobre este processo
            </p>
          </div>

          {/* Saldo de Tokens - Apenas Desktop */}
          <div className="hidden lg:block">
            <ChatTokenCounter />
          </div>

          {/* Botão de Dicas de Prompts */}
          <button
            onClick={() => setShowPromptTips(true)}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bgSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Dicas de Prompts"
          >
            <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 min-h-0" style={{ marginBottom: '10px' }}>
        <div className="max-w-[1280px] mx-auto w-full">
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 mb-4 rounded-full overflow-hidden">
              <img src={avatarUrl} alt="AI Assistant" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: theme === 'dark' ? '#FAFAFA' : colors.textPrimary }}>
              Wis Legal Chat Inteligente
            </h3>
            <p className="text-sm mb-6" style={{ color: theme === 'dark' ? 'rgba(250, 250, 250, 0.7)' : colors.textSecondary }}>
              Faça perguntas sobre o processo, solicite resumos, análises ou esclarecimentos sobre qualquer parte do documento.
            </p>
            <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
              {chatIntroPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => {
                    // Verificar se tem tokens disponíveis
                    if (tokensRemaining <= 0) {
                      setShowNoTokensModal(true);
                      return;
                    }
                    onSendMessage(prompt.prompt_text);
                  }}
                  disabled={isSending}
                  className="px-4 py-3 rounded-lg text-left text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    color: theme === 'dark' ? '#FAFAFA' : colors.textPrimary,
                    border: `1px solid ${colors.border}`
                  }}
                >
                  {prompt.prompt_text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const isNewMessage = index >= previousMessageCount;
          const isLatestAssistantMessage = !isUser && index === messages.length - 1 && isNewMessage;

          return isUser ? (
            <ChatMessageUser
              key={message.id}
              content={message.content}
              createdAt={message.created_at}
              audioUrl={message.audio_url}
              audioDuration={message.audio_duration}
              isAudio={message.is_audio}
            />
          ) : (
            <ChatMessageAssistant
              key={message.id}
              messageId={message.id}
              content={message.content}
              createdAt={message.created_at}
              isLatestMessage={isLatestAssistantMessage}
              initialFeedback={message.feedback_chat}
              processoId={processoId}
            />
          );
        })}

        {(isLoading || isProcessingAudio) && (
          <div className="mb-6 flex items-start space-x-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden">
              <img src={avatarUrl} alt="AI Assistant" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div
                className="inline-block px-4 py-3 rounded-lg"
                style={{ backgroundColor: colors.bgSecondary }}
              >
                <ChatLoadingDots theme={theme} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      <div
        className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-4 pb-[36px] sm:pb-4 sticky bottom-0 left-0 right-0 z-50"
        style={{
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: colors.bgPrimary
        }}>
        <div className="max-w-[1100px] mx-auto w-full">
        <form onSubmit={handleSubmit} className="relative w-full">
          <div
            className="flex flex-col rounded-[20px] sm:rounded-[28px] shadow-sm transition-all duration-200 w-full"
            style={{
              backgroundColor: theme === 'dark' ? '#141312' : '#FAFAFA',
              border: `1px solid ${colors.border}`,
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            {!audioRecorder.isRecording && (
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputValue.trim() && !isSending) {
                      handleSubmit(e);
                    }
                  }
                }}
                placeholder={isSending ? "Analisando sua pergunta..." : "Digite sua pergunta..."}
                rows={1}
                className="w-full px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-2 md:px-5 md:pt-5 md:pb-3 resize-none text-sm focus:outline-none bg-transparent placeholder:opacity-50"
                style={{
                  color: theme === 'dark' ? '#FAFAFA' : colors.textPrimary,
                  minHeight: '44px',
                  maxHeight: '120px',
                  fontSize: '14px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
                disabled={isSending}
              />
            )}

            {audioRecorder.isRecording ? (
              <AudioRecordingAnimation
                recordingTime={audioRecorder.recordingTime}
                onCancel={handleCancelRecording}
                onStop={handleStopRecording}
              />
            ) : (
              <div className="flex items-center justify-between px-3 pb-2 pt-1.5 min-h-[50px] sm:px-4 sm:pb-3 sm:pt-2 sm:min-h-[60px] md:px-5 md:pb-4 md:pt-3 md:min-h-[80px]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={isSending}
                    className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 ml-1 md:ml-2"
                    style={{
                      backgroundColor: 'transparent',
                      color: theme === 'dark' ? '#FAFAFA' : colors.textSecondary
                    }}
                    title="Gravar áudio"
                  >
                    <Mic className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!inputValue.trim() || isSending}
                  className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full transition-all duration-200 disabled:cursor-not-allowed hover:scale-105"
                  style={{
                    backgroundColor: isSending
                      ? '#FAFAFA'
                      : (inputValue.trim() && !isSending)
                      ? (theme === 'dark' ? '#FAFAFA' : '#141312')
                      : (theme === 'dark' ? 'rgba(250, 250, 250, 0.2)' : 'rgba(41, 50, 58, 0.2)'),
                    color: isSending
                      ? '#313B44'
                      : (inputValue.trim() && !isSending)
                      ? (theme === 'dark' ? '#141312' : '#FAFAFA')
                      : (theme === 'dark' ? '#FAFAFA' : colors.textSecondary)
                  }}
                  title="Enviar mensagem"
                >
                  {isSending ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        </form>

        {audioRecorder.error && (
          <div
            className="mt-2 px-4 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444'
            }}
          >
            {audioRecorder.error}
          </div>
        )}
        </div>
      </div>

      {/* Modal de Falta de Tokens */}
      {showNoTokensModal && onNavigateToSubscription && onNavigateToTokens && (
        <NoTokensModal
          isOpen={showNoTokensModal}
          onClose={() => setShowNoTokensModal(false)}
          onNavigateToSubscription={onNavigateToSubscription}
          onNavigateToTokens={onNavigateToTokens}
        />
      )}

      {/* Modal de Dicas de Prompts */}
      {showPromptTips && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPromptTips(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: colors.bgPrimary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between p-4 sm:p-6 border-b" style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}>
              <div className="flex items-center space-x-3">
                <Lightbulb className="w-6 h-6" style={{ color: theme === 'dark' ? '#FBBF24' : '#F59E0B' }} />
                <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                  Dicas de Prompts
                </h2>
              </div>
              <button
                onClick={() => setShowPromptTips(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: colors.textSecondary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bgSecondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Experimente estes prompts prontos para obter informações detalhadas sobre o processo:
              </p>

              <div className="space-y-4">
                {/* Categoria: Prompts de Introdução */}
                {chatIntroPrompts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: colors.textPrimary }}>
                      <span className="w-1 h-4 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#60A5FA' : '#3B82F6' }}></span>
                      <span>Prompts de Introdução</span>
                    </h3>
                    <div className="space-y-2">
                      {chatIntroPrompts.map((prompt) => (
                        <button
                          key={prompt.id}
                          onClick={async () => {
                            setShowPromptTips(false);
                            // Verificar se tem tokens disponíveis
                            if (tokensRemaining <= 0) {
                              setShowNoTokensModal(true);
                              return;
                            }
                            await onSendMessage(prompt.prompt_text);
                          }}
                          className="w-full text-left p-3 rounded-lg transition-colors text-sm"
                          style={{
                            backgroundColor: colors.bgSecondary,
                            color: colors.textPrimary
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bgSecondary}
                        >
                          {prompt.prompt_text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categoria: Análise Detalhada */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: colors.textPrimary }}>
                    <span className="w-1 h-4 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#34D399' : '#10B981' }}></span>
                    <span>Análise Detalhada</span>
                  </h3>
                  <div className="space-y-2">
                    {[
                      'Quais são os pedidos do autor?',
                      'Qual é a defesa apresentada pelo réu?',
                      'Existem documentos ou provas relevantes?',
                      'Quais são os valores envolvidos na causa?'
                    ].map((prompt, index) => (
                      <button
                        key={index}
                        onClick={async () => {
                          setShowPromptTips(false);
                          // Verificar se tem tokens disponíveis
                          if (tokensRemaining <= 0) {
                            setShowNoTokensModal(true);
                            return;
                          }
                          await onSendMessage(prompt);
                        }}
                        className="w-full text-left p-3 rounded-lg transition-colors text-sm"
                        style={{
                          backgroundColor: colors.bgSecondary,
                          color: colors.textPrimary
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bgSecondary}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoria: Prazos e Próximos Passos */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: colors.textPrimary }}>
                    <span className="w-1 h-4 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#F59E0B' : '#D97706' }}></span>
                    <span>Prazos e Próximos Passos</span>
                  </h3>
                  <div className="space-y-2">
                    {[
                      'Existem prazos pendentes neste processo?',
                      'Qual deve ser o próximo passo processual?',
                      'Há alguma audiência agendada?',
                      'Quais são as datas importantes deste processo?'
                    ].map((prompt, index) => (
                      <button
                        key={index}
                        onClick={async () => {
                          setShowPromptTips(false);
                          // Verificar se tem tokens disponíveis
                          if (tokensRemaining <= 0) {
                            setShowNoTokensModal(true);
                            return;
                          }
                          await onSendMessage(prompt);
                        }}
                        className="w-full text-left p-3 rounded-lg transition-colors text-sm"
                        style={{
                          backgroundColor: colors.bgSecondary,
                          color: colors.textPrimary
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bgSecondary}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoria: Estratégia */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: colors.textPrimary }}>
                    <span className="w-1 h-4 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#A78BFA' : '#8B5CF6' }}></span>
                    <span>Estratégia</span>
                  </h3>
                  <div className="space-y-2">
                    {[
                      'Quais são os pontos fortes da minha posição?',
                      'Quais são os riscos envolvidos neste processo?',
                      'Existem jurisprudências citadas?',
                      'Qual é a fundamentação legal utilizada?'
                    ].map((prompt, index) => (
                      <button
                        key={index}
                        onClick={async () => {
                          setShowPromptTips(false);
                          // Verificar se tem tokens disponíveis
                          if (tokensRemaining <= 0) {
                            setShowNoTokensModal(true);
                            return;
                          }
                          await onSendMessage(prompt);
                        }}
                        className="w-full text-left p-3 rounded-lg transition-colors text-sm"
                        style={{
                          backgroundColor: colors.bgSecondary,
                          color: colors.textPrimary
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bgSecondary}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
