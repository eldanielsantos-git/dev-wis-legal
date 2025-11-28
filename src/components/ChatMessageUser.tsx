import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { Mic } from 'lucide-react';

interface ChatMessageUserProps {
  content: string;
  createdAt: string;
  audioUrl?: string;
  audioDuration?: number;
  isAudio?: boolean;
}

export function ChatMessageUser({ content, createdAt, audioUrl, audioDuration, isAudio }: ChatMessageUserProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { profile } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  useEffect(() => {
    console.log('[ChatMessageUser] Profile:', {
      exists: !!profile,
      avatar_url: profile?.avatar_url,
      first_name: profile?.first_name,
      last_name: profile?.last_name
    });
  }, [profile]);

  return (
    <div className="mb-6 flex items-start space-x-3 flex-row-reverse space-x-reverse">
      <UserAvatar
        avatarUrl={profile?.avatar_url}
        firstName={profile?.first_name}
        lastName={profile?.last_name}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-end">
          <div
            className="inline-block px-4 py-5 sm:py-3 rounded-2xl max-w-[80%]"
            style={{
              backgroundColor: theme === 'dark' ? '#141312' : '#F3F4F6',
              color: theme === 'dark' ? '#FAFAFA' : colors.textPrimary
            }}
          >
            {isAudio && audioUrl ? (
              <div>
                <div className="flex items-center gap-3 min-h-[64px] py-2">
                  <button
                    onClick={handlePlayPause}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(41, 50, 58, 0.1)',
                      color: colors.textPrimary
                    }}
                  >
                    {isPlaying ? (
                      <img
                        src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/pause-audio.svg"
                        alt="Pause"
                        className="w-5 h-5"
                      />
                    ) : (
                      <img
                        src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/play-audio.svg"
                        alt="Play"
                        className="w-5 h-5"
                      />
                    )}
                  </button>

                  <div className="flex-1 flex items-center gap-2">
                    <Mic className="w-4 h-4" style={{ color: colors.textSecondary }} />
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(41, 50, 58, 0.1)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-100"
                          style={{
                            width: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%`,
                            backgroundColor: theme === 'dark' ? '#FFFFFF' : '#141312'
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                        {formatTime(currentTime || 0)} / {formatTime(audioDuration || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                  preload="metadata"
                />
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
            )}
          </div>
        </div>
        <p className="text-xs mt-1 text-right mr-1" style={{ color: colors.textSecondary }}>
          {new Date(createdAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}
