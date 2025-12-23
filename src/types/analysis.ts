/**
 * Tipos TypeScript consolidados para análises forenses
 *
 * Estruturas base que refletem os padrões já usados nas views.
 * USO OPCIONAL - não substitui interfaces locais existentes.
 */

export interface BaseCampo {
  id: string;
  label?: string;
  valor: string | string[] | number | any;
}

export interface BaseSecao {
  id: string;
  titulo: string;
  campos?: BaseCampo[];
}

export interface BaseAnalysisData<T> {
  titulo: string;
  secoes: T[];
}

export interface BaseDocumental {
  arquivo?: string;
  pagina?: number | string;
  eventoNoSistema?: string;
}

export interface AnalysisParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawContent?: string;
}

export type GravidadeNivel = 'Alta' | 'Média' | 'Baixa';
export type UrgenciaNivel = 'Imediata' | 'Próxima Audiência' | 'Monitoramento';
export type ImpactoNivel = 'Direto' | 'Indireto' | 'Neutro';
export type RiscoNivel = 'Alto' | 'Médio' | 'Baixo';
export type PrioridadeNivel = 'Secundária' | 'Contingente' | 'Oportunista';

export interface ErrorState {
  type: 'parse' | 'structure' | 'validation';
  message: string;
  details?: any;
}

export type DeadlineCategory =
  | 'Audiência'
  | 'Recurso'
  | 'Contestação'
  | 'Petição'
  | 'Réplica'
  | 'Prazo de Defesa'
  | 'Prazo de Apelação'
  | 'Prazo de Manifestação'
  | 'Outro';

export type DeadlinePartyType = 'accusation' | 'defendant' | 'both';
export type DeadlineSourceType = 'auto' | 'manual';
export type DeadlineStatus = 'pending' | 'completed' | 'expired';

export interface ProcessDeadline {
  id: string;
  processo_id: string;
  user_id: string;
  deadline_date: string;
  deadline_time?: string;
  subject: string;
  category?: DeadlineCategory;
  party_type: DeadlinePartyType;
  source_type: DeadlineSourceType;
  analysis_result_id?: string;
  status: DeadlineStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DeadlineWithProcesso extends ProcessDeadline {
  processo_titulo?: string;
  processo_numero?: string;
}
