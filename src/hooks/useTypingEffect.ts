import { useState, useEffect, useRef } from 'react';

interface UseTypingEffectOptions {
  speed?: number;
  chunkSize?: number;
  minLength?: number;
  enabled?: boolean;
}

export function useTypingEffect(
  text: string,
  options: UseTypingEffectOptions = {}
): string {
  const {
    speed = 20,
    chunkSize = 2,
    minLength = 0,
    enabled = true
  } = options;

  const [displayedText, setDisplayedText] = useState(text);
  const [isComplete, setIsComplete] = useState(false);
  const currentIndexRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const textRef = useRef(text);

  useEffect(() => {
    if (!enabled || !text || text.length <= minLength) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    if (textRef.current === text && isComplete) {
      return;
    }

    textRef.current = text;
    setDisplayedText('');
    setIsComplete(false);
    currentIndexRef.current = 0;
    lastTimeRef.current = 0;

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= speed) {
        const newIndex = Math.min(
          currentIndexRef.current + chunkSize,
          text.length
        );

        setDisplayedText(text.slice(0, newIndex));
        currentIndexRef.current = newIndex;
        lastTimeRef.current = timestamp;

        if (newIndex >= text.length) {
          setIsComplete(true);
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [text, speed, chunkSize, minLength, enabled]);

  return displayedText;
}

export function useTypingEffectMultiple(
  texts: string[],
  options: UseTypingEffectOptions = {}
): string[] {
  const [displayedTexts, setDisplayedTexts] = useState<string[]>([]);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const singleTyping = useTypingEffect(
    texts[currentTextIndex] || '',
    options
  );

  useEffect(() => {
    if (currentTextIndex === 0) {
      setDisplayedTexts([]);
    }
  }, [texts]);

  useEffect(() => {
    if (currentTextIndex < texts.length) {
      setDisplayedTexts(prev => {
        const newTexts = [...prev];
        newTexts[currentTextIndex] = singleTyping;
        return newTexts;
      });

      if (singleTyping === texts[currentTextIndex] && currentTextIndex < texts.length - 1) {
        setTimeout(() => {
          setCurrentTextIndex(prev => prev + 1);
        }, 50);
      }
    }
  }, [singleTyping, currentTextIndex, texts]);

  return displayedTexts;
}
