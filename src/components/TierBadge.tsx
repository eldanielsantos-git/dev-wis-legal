import { TierSystemService, TierName } from '../services/TierSystemService';

interface TierBadgeProps {
  tierName: TierName | null;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

export default function TierBadge({
  tierName,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className = '',
}: TierBadgeProps) {
  if (!tierName) return null;

  const tierColor = TierSystemService.getTierColor(tierName);
  const tierIcon = TierSystemService.getTierIcon(tierName);
  const tierLabel = TierSystemService.getTierLabel(tierName);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold text-white ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: tierColor }}
      title={`Tier ${tierLabel} - Processamento ${tierLabel.toLowerCase()}`}
    >
      {showIcon && <span className="mr-1">{tierIcon}</span>}
      {showLabel && <span>{tierLabel}</span>}
    </span>
  );
}
