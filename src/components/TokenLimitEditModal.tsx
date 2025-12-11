import { useState, useEffect } from 'react';
import { X, AlertTriangle, Save, TrendingUp, TrendingDown } from 'lucide-react';
import { TokenLimitConfig, TokenLimitsService } from '../services/TokenLimitsService';
import { useTheme } from '../contexts/ThemeContext';

interface TokenLimitEditModalProps {
  config: TokenLimitConfig;
  onClose: () => void;
  onSave: (id: string, newValue: number) => Promise<void>;
}

export function TokenLimitEditModal({ config, onClose, onSave }: TokenLimitEditModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const icon = TokenLimitsService.getContextIcon(config.context_key);

  const [newValue, setNewValue] = useState(config.max_output_tokens);
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const difference = newValue - config.max_output_tokens;
  const percentageChange = ((difference / config.max_output_tokens) * 100).toFixed(1);
  const isSignificantChange = Math.abs(difference) > config.max_output_tokens * 0.3;

  useEffect(() => {
    const validation = TokenLimitsService.validateTokenValue(
      newValue,
      config.min_allowed,
      config.max_allowed
    );

    if (!validation.isValid) {
      setError(validation.error || '');
    } else {
      setError('');
    }
  }, [newValue, config.min_allowed, config.max_allowed]);

  const handleSave = async () => {
    if (error) return;

    if (isSignificantChange && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(config.id, newValue);
      onClose();
    } catch (err) {
      setError('Erro ao salvar configuração. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (showConfirmation) {
      setShowConfirmation(false);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-2xl rounded-xl shadow-2xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label={config.context_name}>
              {icon}
            </span>
            <div>
              <h2
                className={`text-xl font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Editar Limite de Tokens
              </h2>
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {config.context_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p
              className={`text-sm mb-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {config.context_description}
            </p>
          </div>

          {!showConfirmation ? (
            <>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Limite de Tokens de Output
                </label>
                <input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(parseInt(e.target.value) || 0)}
                  min={config.min_allowed}
                  max={config.max_allowed}
                  step={1024}
                  className={`w-full px-4 py-3 rounded-lg border text-lg font-semibold ${
                    error
                      ? 'border-red-500 focus:ring-red-500'
                      : isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
                  } focus:outline-none focus:ring-2`}
                />
                {error && (
                  <div className="flex items-center gap-2 mt-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-xs font-medium mb-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    Valor Mínimo Permitido
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {config.min_allowed.toLocaleString()} tokens
                  </p>
                </div>

                <div
                  className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-xs font-medium mb-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    Valor Máximo Permitido
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {config.max_allowed.toLocaleString()} tokens
                  </p>
                </div>
              </div>

              {difference !== 0 && !error && (
                <div
                  className={`p-4 rounded-lg ${
                    difference > 0
                      ? isDark
                        ? 'bg-green-900/20 border border-green-800'
                        : 'bg-green-50 border border-green-200'
                      : isDark
                      ? 'bg-orange-900/20 border border-orange-800'
                      : 'bg-orange-50 border border-orange-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {difference > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                    )}
                    <p
                      className={`font-semibold ${
                        difference > 0 ? 'text-green-600' : 'text-orange-600'
                      }`}
                    >
                      {difference > 0 ? 'Aumento' : 'Redução'} de{' '}
                      {Math.abs(difference).toLocaleString()} tokens ({percentageChange}%)
                    </p>
                  </div>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {difference > 0
                      ? 'Aumentar o limite permite respostas mais completas, mas consome mais créditos.'
                      : 'Reduzir o limite economiza créditos, mas pode resultar em respostas incompletas.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div
              className={`p-6 rounded-lg ${
                isDark
                  ? 'bg-yellow-900/20 border border-yellow-800'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-yellow-600 mb-2">
                    Confirmação de Mudança Significativa
                  </h3>
                  <p
                    className={`mb-4 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Você está prestes a fazer uma mudança de{' '}
                    <strong>{Math.abs(parseInt(percentageChange))}%</strong> no limite de
                    tokens. Esta alteração pode impactar significativamente:
                  </p>
                  <ul
                    className={`list-disc list-inside space-y-1 mb-4 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    <li>Qualidade e completude das respostas geradas</li>
                    <li>Consumo de créditos dos usuários</li>
                    <li>Performance do sistema</li>
                  </ul>
                  <p
                    className={`font-semibold ${
                      isDark ? 'text-gray-200' : 'text-gray-900'
                    }`}
                  >
                    Tem certeza que deseja continuar?
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className={`flex items-center justify-end gap-3 p-6 border-t ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDark
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } disabled:opacity-50`}
          >
            {showConfirmation ? 'Voltar' : 'Cancelar'}
          </button>
          <button
            onClick={handleSave}
            disabled={!!error || isSaving || newValue === config.max_output_tokens}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              isDark
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Save className="w-4 h-4" />
            {isSaving
              ? 'Salvando...'
              : showConfirmation
              ? 'Confirmar Mudança'
              : 'Salvar Alteração'}
          </button>
        </div>
      </div>
    </div>
  );
}
