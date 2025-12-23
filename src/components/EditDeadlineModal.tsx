import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, FileText, Tag, Users, Trash2 } from 'lucide-react';
import { processDeadlinesService, UpdateDeadlineInput } from '../services/ProcessDeadlinesService';
import { ProcessDeadline, DeadlineCategory, DeadlinePartyType, DeadlineStatus } from '../types/analysis';
import { DeadlineBadge } from './DeadlineBadge';
import { useToast } from '../hooks/useToast';

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
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    }
  }, [deadline]);

  if (!isOpen || !deadline) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formData.subject || formData.subject.trim().length < 3) {
        showToast('Por favor, informe um assunto válido', 'error');
        setIsSubmitting(false);
        return;
      }

      await processDeadlinesService.updateDeadline(deadline.id, {
        ...formData,
        subject: formData.subject.trim()
      });

      showToast('Prazo atualizado com sucesso!', 'success');
      onDeadlineUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating deadline:', error);
      showToast('Erro ao atualizar prazo. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await processDeadlinesService.deleteDeadline(deadline.id);
      showToast('Prazo excluído com sucesso!', 'success');
      onDeadlineDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting deadline:', error);
      showToast('Erro ao excluir prazo. Tente novamente.', 'error');
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Editar Prazo
            </h2>
            <DeadlineBadge status={deadline.status} size="sm" />
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Assunto do Prazo *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Ex: Prazo para contestação"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Data do Prazo *
              </label>
              <input
                type="date"
                value={formData.deadline_date}
                onChange={(e) => handleChange('deadline_date', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Hora (Opcional)
              </label>
              <input
                type="time"
                value={formData.deadline_time}
                onChange={(e) => handleChange('deadline_time', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Tag className="w-4 h-4 inline mr-2" />
              Categoria (Opcional)
            </label>
            <select
              value={formData.category || ''}
              onChange={(e) => handleChange('category', e.target.value as DeadlineCategory || undefined)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Selecione uma categoria</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Parte Relacionada
            </label>
            <select
              value={formData.party_type}
              onChange={(e) => handleChange('party_type', e.target.value as DeadlinePartyType)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="both">Ambas as Partes</option>
              <option value="accusation">Acusação</option>
              <option value="defendant">Defesa</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value as DeadlineStatus)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="pending">Pendente</option>
              <option value="completed">Concluído</option>
              <option value="expired">Vencido</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Observações (Opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Adicione observações sobre este prazo..."
              maxLength={500}
            />
          </div>

          {showDeleteConfirm ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-300 mb-3">
                Tem certeza que deseja excluir este prazo? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir Prazo
            </button>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
