import React, { useState } from 'react';
import { X, Calendar, Clock, FileText, Tag, Users } from 'lucide-react';
import { processDeadlinesService, CreateDeadlineInput } from '../services/ProcessDeadlinesService';
import { DeadlineCategory, DeadlinePartyType } from '../types/analysis';
import { useToast } from '../hooks/useToast';

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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Novo Prazo
          </h2>
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
              {isSubmitting ? 'Criando...' : 'Criar Prazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
