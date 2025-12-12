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
