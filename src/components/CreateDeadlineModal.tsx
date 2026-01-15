import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Clock, FileText, Tag, Users, Search, AlertCircle } from 'lucide-react';
import { processDeadlinesService, CreateDeadlineInput } from '../services/ProcessDeadlinesService';
import { DeadlineCategory, DeadlinePartyType } from '../types/analysis';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { ProcessosService } from '../services/ProcessosService';
import type { Processo } from '../lib/supabase';
import { Input } from './ui/input';
import { DatePickerField } from './ui/date-picker-field';
import { DropdownField } from './ui/dropdown-field';
import { TimePicker } from './ui/time-picker';

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
  const toast = useToast();
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Processo[]>([]);
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [validationError, setValidationError] = useState<string>('');

  const [formData, setFormData] = useState<CreateDeadlineInput>({
    processo_id: processoId || '',
    deadline_date: prefilledDate || '',
    deadline_time: '',
    subject: '',
    category: undefined,
    party_type: undefined as DeadlinePartyType | undefined,
    notes: ''
  });

  useEffect(() => {
    if (processoId && isOpen) {
      ProcessosService.getProcessoById(processoId).then(processo => {
        if (processo) {
          setSelectedProcesso(processo);
          setSearchQuery(processo.numero_processo || processo.nome_processo || '');
        }
      });
    }
  }, [processoId, isOpen]);

  useEffect(() => {
    if (isOpen && prefilledDate) {
      setFormData(prev => ({ ...prev, deadline_date: prefilledDate }));
    }
  }, [isOpen, prefilledDate]);

  useEffect(() => {
    const searchProcessos = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      if (selectedProcesso) {
        return;
      }

      setIsSearching(true);
      try {
        const processos = await ProcessosService.getAllProcessos();
        console.log('Total processos:', processos.length);

        const query = searchQuery.toLowerCase();
        const filtered = processos.filter(p => {
          if (p.file_name?.toLowerCase().includes(query)) {
            return true;
          }

          if (p.visao_geral_processo) {
            try {
              const visaoGeral = typeof p.visao_geral_processo === 'string'
                ? JSON.parse(p.visao_geral_processo)
                : p.visao_geral_processo;
              const numeroProcesso = visaoGeral.numero_processo?.toLowerCase() || '';
              const partesAutor = visaoGeral.partes?.autor?.toLowerCase() || '';
              const partesReu = visaoGeral.partes?.reu?.toLowerCase() || '';
              const partesString = `${partesAutor} ${partesReu}`.toLowerCase();

              if (numeroProcesso.includes(query) || partesString.includes(query)) {
                return true;
              }
            } catch (e) {
            }
          }

          return false;
        }).slice(0, 10);

        console.log('Search query:', searchQuery);
        console.log('Filtered processos:', filtered.length);
        console.log('Will show results:', filtered.length > 0);
        setSearchResults(filtered);
        setShowResults(filtered.length > 0);
      } catch (error) {
        console.error('Error searching processos:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchProcessos, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedProcesso]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== handleSubmit called ===');
    setValidationError('');
    setIsSubmitting(true);

    try {
      console.log('Selected processo:', selectedProcesso);
      console.log('Form data:', formData);

      if (!selectedProcesso) {
        console.error('Validation failed: No processo selected');
        setValidationError('Por favor, selecione um processo antes de continuar.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.subject || formData.subject.trim().length < 3) {
        console.error('Validation failed: Invalid subject');
        setValidationError('Por favor, informe um assunto válido para o prazo (mínimo 3 caracteres).');
        setIsSubmitting(false);
        return;
      }

      if (!formData.deadline_date) {
        console.error('Validation failed: No deadline_date');
        setValidationError('Por favor, informe a data do prazo.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.deadline_time) {
        console.error('Validation failed: No deadline_time');
        setValidationError('Por favor, informe o horário do prazo.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.category) {
        console.error('Validation failed: No category');
        setValidationError('Por favor, selecione uma categoria para o prazo.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.party_type) {
        console.error('Validation failed: No party_type');
        setValidationError('Por favor, selecione a parte relacionada ao prazo.');
        setIsSubmitting(false);
        return;
      }

      const deadlineData = {
        processo_id: selectedProcesso.id,
        deadline_date: formData.deadline_date,
        deadline_time: formData.deadline_time,
        subject: formData.subject.trim(),
        category: formData.category,
        party_type: formData.party_type,
        notes: formData.notes
      };

      console.log('Creating deadline with data:', deadlineData);
      console.log('Calling processDeadlinesService.createDeadline...');

      const result = await processDeadlinesService.createDeadline(deadlineData);
      console.log('Deadline created successfully:', result);

      toast.success('Prazo criado com sucesso!');

      setFormData({
        processo_id: '',
        deadline_date: '',
        deadline_time: '',
        subject: '',
        category: undefined,
        party_type: undefined as DeadlinePartyType | undefined,
        notes: ''
      });
      setSearchQuery('');
      setSelectedProcesso(null);
      setSearchResults([]);
      setShowResults(false);

      onClose();
      setTimeout(() => onDeadlineCreated(), 0);
    } catch (error: any) {
      console.error('=== Error creating deadline ===');
      console.error('Error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error details:', error?.details);
      console.error('Error hint:', error?.hint);
      toast.error(`Erro ao criar prazo: ${error?.message || 'Tente novamente.'}`);
    } finally {
      setIsSubmitting(false);
      console.log('=== handleSubmit completed ===');
    }
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleChange = (
    field: keyof CreateDeadlineInput,
    value: string | DeadlineCategory | DeadlinePartyType | undefined
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectProcesso = (processo: Processo) => {
    setSelectedProcesso(processo);

    let displayName = processo.file_name;
    if (processo.visao_geral_processo) {
      try {
        const visaoGeral = typeof processo.visao_geral_processo === 'string'
          ? JSON.parse(processo.visao_geral_processo)
          : processo.visao_geral_processo;
        if (visaoGeral.numero_processo) {
          displayName = visaoGeral.numero_processo;
        }
      } catch (e) {
      }
    }

    setSearchQuery(displayName || '');
    setShowResults(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (selectedProcesso) {
      let currentDisplay = selectedProcesso.file_name;
      if (selectedProcesso.visao_geral_processo) {
        try {
          const visaoGeral = typeof selectedProcesso.visao_geral_processo === 'string'
            ? JSON.parse(selectedProcesso.visao_geral_processo)
            : selectedProcesso.visao_geral_processo;
          if (visaoGeral.numero_processo) {
            currentDisplay = visaoGeral.numero_processo;
          }
        } catch (e) {}
      }
      if (value !== currentDisplay) {
        setSelectedProcesso(null);
      }
    }
  };

  console.log('Render - showResults:', showResults, 'searchResults:', searchResults.length);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div ref={modalRef} className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" style={{ backgroundColor: theme === 'dark' ? '#000000' : colors.bgSecondary }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 px-5 py-3 flex items-center justify-between" style={{ backgroundColor: theme === 'dark' ? '#000000' : colors.bgSecondary, borderBottom: `1px solid ${colors.border}` }}>
          <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
            Novo Prazo
          </h2>
          <button
            type="button"
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {validationError && (
            <div
              className="flex items-start gap-3 p-4 rounded-lg border"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                borderColor: '#ef4444'
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1" style={{ color: '#ef4444' }}>
                  Campos obrigatórios
                </h4>
                <p className="text-sm" style={{ color: theme === 'dark' ? '#fca5a5' : '#dc2626' }}>
                  {validationError}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setValidationError('')}
                className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-black hover:bg-opacity-10"
                style={{ color: '#ef4444' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="relative" ref={searchContainerRef}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              <Search className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
              Buscar Processo *
            </label>
            <div className="relative">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) {
                    console.log('Focus - showing results:', searchResults.length);
                    setShowResults(true);
                  }
                }}
                placeholder="Digite número, nome ou parte do processo..."
                className="pr-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                </div>
              )}
            </div>

            {showResults && searchResults.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-2 rounded-lg border shadow-xl max-h-60 overflow-y-auto z-[100]"
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.border
                }}
              >
                {searchResults.map(processo => {
                  let numeroProcesso = '';
                  let partes = '';

                  if (processo.visao_geral_processo) {
                    try {
                      const visaoGeral = typeof processo.visao_geral_processo === 'string'
                        ? JSON.parse(processo.visao_geral_processo)
                        : processo.visao_geral_processo;
                      numeroProcesso = visaoGeral.numero_processo || '';
                      if (visaoGeral.partes) {
                        const autor = visaoGeral.partes.autor || '';
                        const reu = visaoGeral.partes.reu || '';
                        partes = [autor, reu].filter(Boolean).join(' × ');
                      }
                    } catch (e) {
                    }
                  }

                  const displayTitle = numeroProcesso || processo.file_name;

                  return (
                    <div
                      key={processo.id}
                      onClick={() => handleSelectProcesso(processo)}
                      className="px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0"
                      style={{
                        borderColor: colors.border,
                        color: colors.textPrimary
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bgPrimary}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="font-medium">
                        {displayTitle}
                      </div>
                      {partes && (
                        <div className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                          {partes}
                        </div>
                      )}
                      {!numeroProcesso && (
                        <div className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          {processo.file_name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedProcesso && (
              <div
                className="mt-2 p-3 rounded-lg flex items-start justify-between"
                style={{ backgroundColor: colors.bgPrimary, border: `1px solid ${colors.accent}20` }}
              >
                <div className="flex-1">
                  <div className="font-medium" style={{ color: colors.textPrimary }}>
                    {(() => {
                      if (selectedProcesso.visao_geral_processo) {
                        try {
                          const visaoGeral = typeof selectedProcesso.visao_geral_processo === 'string'
                            ? JSON.parse(selectedProcesso.visao_geral_processo)
                            : selectedProcesso.visao_geral_processo;
                          return visaoGeral.numero_processo || selectedProcesso.file_name;
                        } catch (e) {
                          return selectedProcesso.file_name;
                        }
                      }
                      return selectedProcesso.file_name;
                    })()}
                  </div>
                  {(() => {
                    if (selectedProcesso.visao_geral_processo) {
                      try {
                        const visaoGeral = typeof selectedProcesso.visao_geral_processo === 'string'
                          ? JSON.parse(selectedProcesso.visao_geral_processo)
                          : selectedProcesso.visao_geral_processo;
                        if (visaoGeral.partes) {
                          const autor = visaoGeral.partes.autor || '';
                          const reu = visaoGeral.partes.reu || '';
                          const partes = [autor, reu].filter(Boolean).join(' × ');
                          if (partes) {
                            return (
                              <div className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                                {partes}
                              </div>
                            );
                          }
                        }
                      } catch (e) {}
                    }
                    return null;
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProcesso(null);
                    setSearchQuery('');
                  }}
                  className="ml-2 p-1 rounded hover:opacity-80"
                  style={{ color: colors.textSecondary }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

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
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                <CalendarIcon className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
                Data do Prazo *
              </label>
              <DatePickerField
                value={formData.deadline_date}
                onChange={(date) => handleChange('deadline_date', date)}
                placeholder="Selecione uma data"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                <Clock className="w-3.5 h-3.5 inline mr-1.5" style={{ color: colors.textSecondary }} />
                Hora *
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
              Categoria *
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
              Parte Relacionada *
            </label>
            <DropdownField
              value={formData.party_type || ''}
              onChange={(value) => handleChange('party_type', value as DeadlinePartyType)}
              options={[
                { value: 'both', label: 'Ambas as Partes' },
                { value: 'author', label: 'Autor' },
                { value: 'defendant', label: 'Réu' },
                { value: 'third_party', label: 'Terceiro' }
              ]}
              placeholder="Selecione a parte relacionada"
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
                  color: (formData.notes?.length || 0) >= 250 ? '#ef4444' : colors.textSecondary
                }}
              >
                {formData.notes?.length || 0}/250
              </span>
            </div>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              rows={2}
              placeholder="Adicione observações sobre este prazo..."
              maxLength={250}
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
              {isSubmitting ? 'Criando...' : 'Criar Prazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
