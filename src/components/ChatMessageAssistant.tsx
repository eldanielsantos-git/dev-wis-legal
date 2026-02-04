import React, { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { useTypingEffectChat } from '../hooks/useTypingEffectChat';
import { AnalysisContentRenderer } from './AnalysisContentRenderer';
import { supabase } from '../lib/supabase';
import { generateDocx } from '../utils/nativeDocxGenerator';

interface ChatMessageAssistantProps {
  messageId: string;
  content: string;
  createdAt: string;
  isLatestMessage: boolean;
  initialFeedback?: 'like' | 'dislike' | null;
  processoId?: string | null;
}

export function ChatMessageAssistant({ messageId, content, createdAt, isLatestMessage, initialFeedback, processoId }: ChatMessageAssistantProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const avatarUrl = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/avatar-ai.svg';

  const [shouldAnimate, setShouldAnimate] = useState(isLatestMessage);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(initialFeedback || null);
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState(false);
  const messageRef = React.useRef<HTMLDivElement>(null);

  const handleTextUpdate = React.useCallback(() => {
    if (messageRef.current && shouldAnimate) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [shouldAnimate]);

  const { displayedText, isComplete, skipTyping } = useTypingEffectChat({
    text: content,
    speed: 15,
    enabled: shouldAnimate,
    onTextUpdate: handleTextUpdate
  });

  useEffect(() => {
    if (!isLatestMessage) {
      setShouldAnimate(false);
    }
  }, [isLatestMessage]);

  const handleFeedback = async (type: 'like' | 'dislike') => {
    if (isUpdatingFeedback) return;

    try {
      setIsUpdatingFeedback(true);
      const newFeedback = feedback === type ? null : type;

      const { data, error } = await supabase
        .from('chat_messages')
        .update({ feedback_chat: newFeedback })
        .eq('id', messageId)
        .select();

      if (error) {
        throw error;
      }

      setFeedback(newFeedback);
    } catch (error) {
    } finally {
      setIsUpdatingFeedback(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await generateDocx(content, processoId || undefined);
      const filename = processoId ? `Wis_Export_${processoId}.docx` : `Wis_Export_${new Date().getTime()}.docx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
    }
  };

  return (
    <div ref={messageRef} className="mb-6 flex items-start space-x-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden">
        <img src={avatarUrl} alt="AI Assistant" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-start">
          <div
            className="relative px-4 py-5 sm:py-3 rounded-2xl max-w-[90%] cursor-pointer"
            style={{
              backgroundColor: colors.bgSecondary,
              color: theme === 'dark' ? '#FAFAFA' : colors.textPrimary
            }}
            onClick={!isComplete ? skipTyping : undefined}
            title={!isComplete ? 'Clique para mostrar texto completo' : undefined}
          >
            <div className="text-sm opacity-0 pointer-events-none absolute inset-0 px-4 py-5 sm:py-3">
              <AnalysisContentRenderer content={content} />
            </div>
            <div className="text-sm">
              <AnalysisContentRenderer content={displayedText} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 ml-1">
          <p className="text-xs" style={{ color: colors.textSecondary }}>
            {new Date(createdAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => handleFeedback('like')}
              disabled={isUpdatingFeedback}
              className="p-1.5 rounded-md transition-all duration-200 hover:bg-black hover:bg-opacity-5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: feedback === 'like' ? '#10B981' : colors.textSecondary,
              }}
              title="Gostei"
            >
              <ThumbsUp className="w-4 h-4" fill={feedback === 'like' ? '#10B981' : 'none'} />
            </button>
            <button
              onClick={() => handleFeedback('dislike')}
              disabled={isUpdatingFeedback}
              className="p-1.5 rounded-md transition-all duration-200 hover:bg-black hover:bg-opacity-5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: feedback === 'dislike' ? '#D1D5DB' : colors.textSecondary,
              }}
              title="Não gostei"
            >
              <ThumbsDown className="w-4 h-4" fill={feedback === 'dislike' ? '#D1D5DB' : 'none'} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md transition-all duration-200 hover:bg-black hover:bg-opacity-5"
              style={{ color: colors.textSecondary }}
              title="Copiar mensagem"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md transition-all duration-200 hover:bg-black hover:bg-opacity-5"
              style={{ color: colors.textSecondary }}
              title="Baixar como DOCX"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
