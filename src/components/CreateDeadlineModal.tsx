import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Clock, FileText, Tag, Users, Search } from 'lucide-react';
import { processDeadlinesService, CreateDeadlineInput } from '../services/ProcessDeadlinesService';
import { DeadlineCategory, DeadlinePartyType } from '../types/analysis';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { ProcessosService } from '../services/ProcessosService';
import type { Processo } from '../lib/supabase';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Processo[]>([]);
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<CreateDeadlineInput>({
    processo_id: processoId || '',
    deadline_date: prefilledDate || '',
    deadline_time: '',
    subject: '',
    category: undefined,
    party_type: 'both',
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
    const searchProcessos = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const processos = await ProcessosService.getAllProcessos();
        const filtered = processos.filter(p => {
          const query = searchQuery.toLowerCase();
          return (
            p.numero_processo?.toLowerCase().includes(query) ||
            p.nome_processo?.toLowerCase().includes(query) ||
            p.partes?.toLowerCase().includes(query)
          );
        }).slice(0, 10);

        console.log('Filtered processos:', filtered.length);
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
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!selectedProcesso) {
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
        processo_id: selectedProcesso.id,
        subject: formData.subject.trim()
      });

      showToast('Prazo criado com sucesso!', 'success');
      onDeadlineCreated();
      onClose();
      setFormData({
        processo_id: '',
        deadline_date: '',
        deadline_time: '',
        subject: '',
        category: undefined,
        party_type: 'both',
        notes: ''
      });
      setSearchQuery('');
      setSelectedProcesso(null);
      setSearchResults([]);
      setShowResults(false);
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

  const handleSelectProcesso = (processo: Processo) => {
    setSelectedProcesso(processo);
    setSearchQuery(processo.numero_processo || processo.nome_processo || '');
    setShowResults(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (selectedProcesso && value !== (selectedProcesso.numero_processo || selectedProcesso.nome_processo)) {
      setSelectedProcesso(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" style={{ backgroundColor: colors.bgSecondary }}>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div className="relative" ref={searchContainerRef}>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              <Search className="w-4 h-4 inline mr-2" />
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
                required
                className="pr-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                </div>
              )}
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="absolute w-full mt-2 rounded-lg border bg-popover shadow-lg max-h-60 overflow-y-auto z-[10000]">
                {searchResults.map(processo => (
                  <div
                    key={processo.id}
                    onClick={() => handleSelectProcesso(processo)}
                    className="px-4 py-3 cursor-pointer transition-colors hover:bg-accent border-b last:border-b-0"
                  >
                    <div className="font-medium text-foreground">
                      {processo.numero_processo || processo.nome_processo}
                    </div>
                    {processo.partes && (
                      <div className="text-sm mt-1 text-muted-foreground">
                        {processo.partes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedProcesso && (
              <div
                className="mt-2 p-3 rounded-lg flex items-start justify-between"
                style={{ backgroundColor: colors.bgPrimary, border: `1px solid ${colors.accent}20` }}
              >
                <div className="flex-1">
                  <div className="font-medium" style={{ color: colors.textPrimary }}>
                    {selectedProcesso.numero_processo || selectedProcesso.nome_processo}
                  </div>
                  {selectedProcesso.partes && (
                    <div className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                      {selectedProcesso.partes}
                    </div>
                  )}
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
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              <FileText className="w-4 h-4 inline mr-2" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                <CalendarIcon className="w-4 h-4 inline mr-2" />
                Data do Prazo *
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.deadline_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.deadline_date ? (
                      format(new Date(formData.deadline_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    selected={formData.deadline_date ? new Date(formData.deadline_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        handleChange('deadline_date', format(date, 'yyyy-MM-dd'))
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                <Clock className="w-4 h-4 inline mr-2" />
                Hora (Opcional)
              </label>
              <Input
                type="time"
                value={formData.deadline_time}
                onChange={(e) => handleChange('deadline_time', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              <Tag className="w-4 h-4 inline mr-2" />
              Categoria (Opcional)
            </label>
            <Select
              value={formData.category || ''}
              onValueChange={(value) => handleChange('category', value as DeadlineCategory || undefined)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              <Users className="w-4 h-4 inline mr-2" />
              Parte Relacionada
            </label>
            <Select
              value={formData.party_type}
              onValueChange={(value) => handleChange('party_type', value as DeadlinePartyType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Ambas as Partes</SelectItem>
                <SelectItem value="accusation">Acusação</SelectItem>
                <SelectItem value="defendant">Defesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              Observações (Opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
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
