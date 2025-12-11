import { Edit2, CheckCircle } from 'lucide-react';
import { TokenLimitConfig, TokenLimitsService } from '../services/TokenLimitsService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface TokenLimitCardProps {
  config: TokenLimitConfig;
  onEdit: (config: TokenLimitConfig) => void;
}

export function TokenLimitCard({ config, onEdit }: TokenLimitCardProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const category = TokenLimitsService.getContextCategory(config.context_key);
  const icon = TokenLimitsService.getContextIcon(config.context_key);

  const categoryColor = category === 'analysis' ? colors.primary : colors.success;

  return (
    <div
      className="rounded-lg border transition-all duration-200 hover:shadow-lg"
      style={{
        backgroundColor: colors.cardBackground,
        borderColor: colors.border,
      }}
    >
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: categoryColor }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-2xl" role="img" aria-label={config.context_name}>
              {icon}
            </span>
            <h3 className="text-base font-semibold" style={{ color: colors.text }}>
              {config.context_name}
            </h3>
          </div>

          <button
            onClick={() => onEdit(config)}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: colors.mutedText }}
            title="Editar configuração"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div
            className="flex items-baseline justify-between p-3 rounded-lg"
            style={{ backgroundColor: colors.background }}
          >
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: colors.mutedText }}>
                Limite Atual
              </p>
              <p className="text-2xl font-bold" style={{ color: colors.text }}>
                {config.max_output_tokens.toLocaleString()}
              </p>
            </div>
            <span className="text-xs font-medium" style={{ color: colors.mutedText }}>
              tokens
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: colors.background }}
            >
              <p className="text-xs font-medium mb-0.5" style={{ color: colors.mutedText }}>
                Mínimo
              </p>
              <p className="text-sm font-semibold" style={{ color: colors.text }}>
                {config.min_allowed.toLocaleString()}
              </p>
            </div>

            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: colors.background }}
            >
              <p className="text-xs font-medium mb-0.5" style={{ color: colors.mutedText }}>
                Máximo
              </p>
              <p className="text-sm font-semibold" style={{ color: colors.text }}>
                {config.max_allowed.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {config.is_active && (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-green-500 font-medium">Ativo</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
