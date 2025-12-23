import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, Clock, FileText, Tag, Users, Trash2 } from 'lucide-react';
import { processDeadlinesService, UpdateDeadlineInput } from '../services/ProcessDeadlinesService';
import { ProcessDeadline, DeadlineCategory, DeadlinePartyType, DeadlineStatus } from '../types/analysis';
import { DeadlineBadge } from './DeadlineBadge';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { ProcessosService } from '../services/ProcessosService';
import type { Processo } from '../lib/supabase';
import { Input } from './ui/input';
import { DatePickerField } from './ui/date-picker-field';
import { DropdownField } from './ui/dropdown-field';
import { TimePicker } from './ui/time-picker';

interface EditDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  deadline: ProcessDeadline | null;
  onDeadlineUpdated: () => void;
  onDeadlineDeleted: () => void;
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

export const EditDeadlineModal: React.FC<EditDeadlineModalProps> = ({
  isOpen,
  onClose,
  deadline,
  onDeadlineUpdated,
  onDeadlineDeleted
}) => {
  const toast = useToast();
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [processo, setProcesso] = useState<Processo | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<UpdateDeadlineInput>({
    deadline_date: '',
    deadline_time: '',
    subject: '',
    category: undefined,
    party_type: 'both',
    status: 'pending',
    notes: ''
  });

  useEffect(() => {
    if (deadline) {
      setFormData({
        deadline_date: deadline.deadline_date,
        deadline_time: deadline.deadline_time || '',
        subject: deadline.subject,
        category: deadline.category,
        party_type: deadline.party_type,
        status: deadline.status,
        notes: deadline.notes || ''
      });

      ProcessosService.getProcessoById(deadline.processo_id).then(proc => {
        if (proc) {
          setProcesso(proc);
        }
      });
    }
  }, [deadline]);

  useEffect(() => {
    const handleModalClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (showDeleteConfirm) {
        return;
      }

      const isPortalClick = target.closest('[role="dialog"]') ||
                           target.closest('[data-radix-popper-content-wrapper]') ||
                           target.closest('[data-radix-select-content]') ||
                           target.closest('[data-radix-popover-content]');

      if (isPortalClick) {
        return;
      }

      if (modalRef.current && !modalRef.current.contains(target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showDeleteConfirm) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleModalClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleModalClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose, showDeleteConfirm]);

  if (!isOpen || !deadline) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formData.subject || formData.subject.trim().length < 3) {
        toast.error('Por favor, informe um assunto válido');
        setIsSubmitting(false);
        return;
      }

      await processDeadlinesService.updateDeadline(deadline.id, {
        ...formData,
        subject: formData.subject.trim()
      });

      toast.success('Prazo atualizado com sucesso!');
      onClose();
      setTimeout(() => onDeadlineUpdated(), 0);
    } catch (error) {
      console.error('Error updating deadline:', error);
      toast.error('Erro ao atualizar prazo. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await processDeadlinesService.deleteDeadline(deadline.id);
      toast.success('Prazo excluído com sucesso!');
      onClose();
      setTimeout(() => onDeadlineDeleted(), 0);
    } catch (error) {
      console.error('Error deleting deadline:', error);
      toast.error('Erro ao excluir prazo. Tente novamente.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChange = (
    field: keyof UpdateDeadlineInput,
    value: string | DeadlineCategory | DeadlinePartyType | DeadlineStatus | undefined
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" style={{ backgroundColor: colors.bgSecondary }}>
        <div className="sticky top-0 px-5 py-3 flex items-center justify-between" style={{ backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
              Editar Prazo
            </h2>
            <DeadlineBadge status={deadline.status} size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: colors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bgPrimary}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Excluir prazo"
              title="Excluir prazo"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bgPrimary}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {processo && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                <FileText className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
                Processo Associado
              </label>
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: colors.bgPrimary, border: `1px solid ${colors.accent}20` }}
              >
                <div className="font-medium" style={{ color: colors.textPrimary }}>
                  {processo.file_name}
                </div>
                {(() => {
                  if (processo.visao_geral_processo) {
                    try {
                      const visaoGeral = typeof processo.visao_geral_processo === 'string'
                        ? JSON.parse(processo.visao_geral_processo)
                        : processo.visao_geral_processo;
                      if (visaoGeral.numero_processo) {
                        return (
                          <div className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                            {visaoGeral.numero_processo}
                          </div>
                        );
                      }
                    } catch (e) {}
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              <FileText className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
              Assunto do Prazo *
            </label>
            <Input
              type="text"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              placeholder="Ex: Prazo para contestação"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                <Calendar className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
                Data do Prazo *
              </label>
              <DatePickerField
                value={formData.deadline_date}
                onChange={(date) => handleChange('deadline_date', date)}
                placeholder="Selecione uma data"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                <Clock className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
                Hora (Opcional)
              </label>
              <TimePicker
                value={formData.deadline_time}
                onChange={(time) => handleChange('deadline_time', time)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              <Tag className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
              Categoria (Opcional)
            </label>
            <DropdownField
              value={formData.category || ''}
              onChange={(value) => handleChange('category', value as DeadlineCategory || undefined)}
              options={CATEGORIES.map(cat => ({ value: cat, label: cat }))}
              placeholder="Selecione uma categoria"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              <Users className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
              Parte Relacionada
            </label>
            <DropdownField
              value={formData.party_type}
              onChange={(value) => handleChange('party_type', value as DeadlinePartyType)}
              options={[
                { value: 'both', label: 'Ambas as Partes' },
                { value: 'accusation', label: 'Acusação' },
                { value: 'defendant', label: 'Defesa' }
              ]}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              Status
            </label>
            <DropdownField
              value={formData.status}
              onChange={(value) => handleChange('status', value as DeadlineStatus)}
              options={[
                { value: 'pending', label: 'Pendente' },
                { value: 'completed', label: 'Concluído' },
                { value: 'expired', label: 'Vencido' }
              ]}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium" style={{ color: colors.textSecondary }}>
                Observações (Opcional)
              </label>
              <span
                className="text-xs"
                style={{
                  color: (formData.notes?.length || 0) >= 500 ? '#ef4444' : colors.textSecondary
                }}
              >
                {formData.notes?.length || 0}/500
              </span>
            </div>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              rows={2}
              placeholder="Adicione observações sobre este prazo..."
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 rounded-lg transition-colors font-medium text-sm"
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
              className="flex-1 px-5 py-2.5 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#000000',
                color: '#ffffff'
              }}
              onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#1a1a1a')}
              onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#000000')}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="rounded-lg shadow-xl max-w-md w-full mx-4 p-6" style={{ backgroundColor: colors.bgSecondary }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: colors.textPrimary }}>
              Confirmar Exclusão
            </h3>
            <p className="mb-6" style={{ color: colors.textSecondary }}>
              Tem certeza que deseja excluir este prazo? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg transition-colors font-medium text-sm"
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
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff'
                }}
                onMouseEnter={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = '#b91c1c')}
                onMouseLeave={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = '#dc2626')}
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
