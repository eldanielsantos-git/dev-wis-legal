import { useState, useEffect, useRef } from 'react';

interface UseTypingEffectChatOptions {
  text: string;
  speed?: number;
  enabled?: boolean;
  onTextUpdate?: () => void;
}

export function useTypingEffectChat({ text, speed = 20, enabled = true, onTextUpdate }: UseTypingEffectChatOptions) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);
    indexRef.current = 0;

    const typeNextChar = () => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
        if (onTextUpdate) {
          onTextUpdate();
        }
        timeoutRef.current = setTimeout(typeNextChar, speed);
      } else {
        setIsComplete(true);
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, speed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, enabled, onTextUpdate]);

  const skipTyping = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDisplayedText(text);
    setIsComplete(true);
  };

  return { displayedText, isComplete, skipTyping };
}
