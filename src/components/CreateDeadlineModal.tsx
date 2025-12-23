import React, { useState, useMemo } from 'react';
import { X, Calendar, Clock, FileText, Tag, Users } from 'lucide-react';
import { processDeadlinesService, CreateDeadlineInput } from '../services/ProcessDeadlinesService';
import { DeadlineCategory, DeadlinePartyType } from '../types/analysis';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface CreateDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeadlineCreated: () => void;
  processoId?: string;
  prefilledDate?: string;
}

const CATEGORIES: DeadlineCategory[] = [
  'Audiência',
  'Recurso',
  'Contestação',
  'Petição',
  'Réplica',
  'Prazo de Defesa',
  'Prazo de Apelação',
  'Prazo de Manifestação',
  'Outro'
];

export const CreateDeadlineModal: React.FC<CreateDeadlineModalProps> = ({
  isOpen,
  onClose,
  onDeadlineCreated,
  processoId,
  prefilledDate
}) => {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreateDeadlineInput>({
    processo_id: processoId || '',
    deadline_date: prefilledDate || '',
    deadline_time: '',
    subject: '',
    category: undefined,
    party_type: 'both',
    notes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formData.processo_id) {
        showToast('Por favor, selecione um processo', 'error');
        setIsSubmitting(false);
        return;
      }

      if (!formData.deadline_date) {
        showToast('Por favor, informe a data do prazo', 'error');
        setIsSubmitting(false);
        return;
      }

      if (!formData.subject || formData.subject.trim().length < 3) {
        showToast('Por favor, informe um assunto válido', 'error');
        setIsSubmitting(false);
        return;
      }

      await processDeadlinesService.createDeadline({
        ...formData,
        subject: formData.subject.trim()
      });

      showToast('Prazo criado com sucesso!', 'success');
      onDeadlineCreated();
      onClose();
      setFormData({
        processo_id: processoId || '',
        deadline_date: prefilledDate || '',
        deadline_time: '',
        subject: '',
        category: undefined,
        party_type: 'both',
        notes: ''
      });
    } catch (error) {
      console.error('Error creating deadline:', error);
      showToast('Erro ao criar prazo. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    field: keyof CreateDeadlineInput,
    value: string | DeadlineCategory | DeadlinePartyType | undefined
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: colors.bgSecondary }}>
        <div className="sticky top-0 px-6 py-4 flex items-center justify-between" style={{ backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}` }}>
          <h2 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Novo Prazo
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bgPrimary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              <FileText className="w-4 h-4 inline mr-2" />
              Assunto do Prazo *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`
              }}
              placeholder="Ex: Prazo para contestação"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                <Calendar className="w-4 h-4 inline mr-2" />
                Data do Prazo *
              </label>
              <input
                type="date"
                value={formData.deadline_date}
                onChange={(e) => handleChange('deadline_date', e.target.value)}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                <Clock className="w-4 h-4 inline mr-2" />
                Hora (Opcional)
              </label>
              <input
                type="time"
                value={formData.deadline_time}
                onChange={(e) => handleChange('deadline_time', e.target.value)}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              <Tag className="w-4 h-4 inline mr-2" />
              Categoria (Opcional)
            </label>
            <select
              value={formData.category || ''}
              onChange={(e) => handleChange('category', e.target.value as DeadlineCategory || undefined)}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`
              }}
            >
              <option value="">Selecione uma categoria</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              <Users className="w-4 h-4 inline mr-2" />
              Parte Relacionada
            </label>
            <select
              value={formData.party_type}
              onChange={(e) => handleChange('party_type', e.target.value as DeadlinePartyType)}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`
              }}
            >
              <option value="both">Ambas as Partes</option>
              <option value="accusation">Acusação</option>
              <option value="defendant">Defesa</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              Observações (Opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`
              }}
              rows={3}
              placeholder="Adicione observações sobre este prazo..."
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-lg transition-colors font-medium"
              style={{
                border: `1px solid ${colors.border}`,
                color: colors.textPrimary,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bgPrimary}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#000000',
                color: '#ffffff'
              }}
              onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#1a1a1a')}
              onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#000000')}
            >
              {isSubmitting ? 'Criando...' : 'Criar Prazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
