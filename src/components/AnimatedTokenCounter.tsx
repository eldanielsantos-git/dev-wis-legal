import { useEffect, useState, useRef } from 'react';
import { Coins, Loader } from 'lucide-react';

interface AnimatedTokenCounterProps {
  tokens: number;
  loading: boolean;
  textColor: string;
  iconColor: string;
  backgroundColor: string;
  theme: string;
}

export function AnimatedTokenCounter({
  tokens,
  loading,
  textColor,
  iconColor,
  backgroundColor,
  theme
}: AnimatedTokenCounterProps) {
  const [displayTokens, setDisplayTokens] = useState(tokens);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousTokensRef = useRef(tokens);

  useEffect(() => {
    console.log('[AnimatedTokenCounter] Tokens changed:', {
      previousTokens: previousTokensRef.current,
      newTokens: tokens,
      loading,
      willAnimate: previousTokensRef.current !== tokens && !loading
    });

    if (previousTokensRef.current === tokens || loading) {
      previousTokensRef.current = tokens;
      setDisplayTokens(tokens);
      return;
    }

    console.log('[AnimatedTokenCounter] Starting animation');
    setIsAnimating(true);

    const difference = tokens - previousTokensRef.current;
    const steps = 20;
    const stepDuration = 30;
    const increment = difference / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayTokens(tokens);
        clearInterval(interval);
        setTimeout(() => setIsAnimating(false), 300);
      } else {
        setDisplayTokens(prev => prev + increment);
      }
    }, stepDuration);

    previousTokensRef.current = tokens;

    return () => clearInterval(interval);
  }, [tokens, loading]);

  return (
    <div
      className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg flex-shrink-0 transition-all duration-300 ${
        isAnimating ? 'scale-110 ring-2 ring-blue-400 ring-opacity-50' : 'scale-100'
      }`}
      style={{ backgroundColor }}
    >
      <Coins
        className={`w-4 h-4 transition-transform duration-300 ${
          isAnimating ? 'rotate-12' : 'rotate-0'
        }`}
        style={{ color: iconColor }}
      />
      {loading ? (
        <Loader className="w-3 h-3 animate-spin" style={{ color: textColor }} />
      ) : (
        <span
          className={`text-xs font-semibold transition-all duration-300 ${
            isAnimating ? 'text-blue-500' : ''
          }`}
          style={{ color: isAnimating ? undefined : textColor }}
        >
          {Math.floor(displayTokens).toLocaleString('pt-BR')}
        </span>
      )}
    </div>
  );
}
