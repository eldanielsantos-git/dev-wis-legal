import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { useTokenBalance } from '../contexts/TokenBalanceContext';
import { AnimatedTokenCounter } from './AnimatedTokenCounter';

interface ChatTokenCounterProps {
  className?: string;
}

export function ChatTokenCounter({ className = '' }: ChatTokenCounterProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { tokensRemaining, loading } = useTokenBalance();

  return (
    <AnimatedTokenCounter
      tokens={tokensRemaining}
      loading={loading}
      textColor={colors.textPrimary}
      iconColor={theme === 'dark' ? '#EDEDED' : '#255886'}
      backgroundColor={colors.bgSecondary}
      theme={theme}
    />
  );
}
