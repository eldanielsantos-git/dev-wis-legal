import React, { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';

interface TypingQueueContextType {
  register: (id: string) => number;
  unregister: (id: string) => void;
  markComplete: (id: string) => void;
  getCurrentPosition: (id: string) => number;
}

const TypingQueueContext = createContext<TypingQueueContextType | null>(null);

let globalIdCounter = 0;

export function TypingQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<string[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const completedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    queueRef.current = queue;
    completedRef.current = completed;
  }, [queue, completed]);

  const register = (id: string): number => {
    setQueue(prev => {
      if (prev.includes(id)) {
        return prev;
      }
      return [...prev, id];
    });
    return queueRef.current.length;
  };

  const unregister = (id: string) => {
    setQueue(prev => prev.filter(item => item !== id));
    setCompleted(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const markComplete = (id: string) => {
    setCompleted(prev => new Set([...prev, id]));
  };

  const getCurrentPosition = (id: string): number => {
    const position = queueRef.current.indexOf(id);
    if (position === -1) return -1;

    const completedCount = queueRef.current
      .slice(0, position)
      .filter(itemId => completedRef.current.has(itemId))
      .length;

    return position - completedCount;
  };

  return (
    <TypingQueueContext.Provider value={{ register, unregister, markComplete, getCurrentPosition }}>
      {children}
    </TypingQueueContext.Provider>
  );
}

export function useTypingQueue() {
  const context = useContext(TypingQueueContext);
  if (!context) {
    throw new Error('useTypingQueue must be used within TypingQueueProvider');
  }
  return context;
}

interface UseSequentialTypingOptions {
  speed?: number;
  chunkSize?: number;
  enabled?: boolean;
}

export function useSequentialTyping(
  text: string,
  options: UseSequentialTypingOptions = {}
): { displayText: string; isReady: boolean; isComplete: boolean } {
  const {
    speed = 15,
    chunkSize = 2,
    enabled = true
  } = options;

  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [myId] = useState(() => `typing-${globalIdCounter++}-${Date.now()}`);

  const currentIndexRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const textRef = useRef(text);

  const queue = useTypingQueue();

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText(text);
      setIsComplete(true);
      setIsReady(true);
      return;
    }

    queue.register(myId);

    return () => {
      queue.unregister(myId);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !text) {
      return;
    }

    const checkPosition = () => {
      const position = queue.getCurrentPosition(myId);

      if (position === 0) {
        setIsReady(true);
      } else {
        setIsReady(false);
      }
    };

    const intervalId = setInterval(checkPosition, 50);
    checkPosition();

    return () => clearInterval(intervalId);
  }, [myId, enabled, text, queue]);

  useEffect(() => {
    if (!enabled || !text || !isReady || isComplete) {
      return;
    }

    if (textRef.current !== text) {
      textRef.current = text;
      currentIndexRef.current = 0;
      setDisplayedText('');
      setIsComplete(false);
    }

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
          queue.markComplete(myId);
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
  }, [text, speed, chunkSize, enabled, isReady, isComplete, myId, queue]);

  return { displayText: displayedText, isReady, isComplete };
}
