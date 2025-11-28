import React from 'react';
import { TokenValidationService } from '../services/TokenValidationService';

interface TokenAvailabilityInfoProps {
  tokensRemaining: number;
  pagesRemaining: number;
  className?: string;
  style?: React.CSSProperties;
}

export const TokenAvailabilityInfo: React.FC<TokenAvailabilityInfoProps> = ({
  tokensRemaining,
  pagesRemaining,
  className = '',
  style = {}
}) => {
  const formatTokenCount = (tokens: number): string => {
    return TokenValidationService.formatTokenCount(tokens);
  };

  const formatNumber = (num: number): string => {
    return TokenValidationService.formatNumber(num);
  };

  return (
    <div className="inline-block px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
      <p className={`text-sm ${className}`} style={style}>
        Você tem <span className="font-semibold" style={{ color: '#141312' }}>{formatTokenCount(tokensRemaining)} tokens</span> disponíveis
        {' '}(aproximadamente <span className="font-semibold" style={{ color: '#141312' }}>{formatNumber(pagesRemaining)} páginas</span>)
      </p>
    </div>
  );
};
