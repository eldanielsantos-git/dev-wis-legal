import { Scale, Clock } from 'lucide-react';
import { safeToString } from '../../utils/safeRender';
import { isNonEmptyArray } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';
import { normalizeGenericView } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface RecursoIdentificado {
 id: string;
 tipoRecurso: string;
 dataInterposicao?: string;
 paginas_referencia?: string;
 tempestividade?: string;
 preparoComprovado?: string;
 regularidadeFormal?: string;
 juizoAdmissibilidade?: string;
 dataDecisaoAdmissibilidade?: string;
 decisaoAdmissibilidadePagina?: string;
 situacaoAtual?: string;
 notas?: string;
}

interface RecursoCabivel {
 id: string;
 tipoDecisaoRecorrivel?: string;
 dataDecisao?: string;
 paginas_referencia?: string;
 recursoCabivel?: string;
 prazoLegal?: string;
 baseLegal?: string;
 dataFinalInterposicao?: string;
 situacao?: string;
 observacoes?: string;
}

interface Secao {
 id: string;
 titulo: string;
 listaRecursosIdentificados?: RecursoIdentificado[];
 listaRecursosCabiveis?: RecursoCabivel[];
}

interface RecursosAdmissibilidade {
 titulo: string;
 secoes: Secao[];
}

interface AdmissibilidadeRecursalViewProps {
 content: string;
}

const getTempestividadeBadge = (tempestividade: string | undefined) => {
 if (safeIncludes(tempestividade, 'tempestivo') && !safeIncludes(tempestividade, 'intempestivo')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(tempestividade, 'intempestivo')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getSituacaoBadge = (situacao: string | undefined) => {
 if (safeIncludes(situacao, 'julgado') || safeIncludes(situacao, 'admitido')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(situacao, 'inadmitido') || safeIncludes(situacao, 'arquivado')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (safeIncludes(situacao, 'pendente') || safeIncludes(situacao, 'em curso')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (safeIncludes(situacao, 'não cabível') || safeIncludes(situacao, 'nenhum')) {
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
 }
 return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
};

export function AdmissibilidadeRecursalView({ content }: AdmissibilidadeRecursalViewProps) {
 const normalizationResult = normalizeGenericView(content, 'recursosAdmissibilidade', ['recursos_admissibilidade', 'admissibilidade', 'recursos']);

 if (!normalizationResult.success) {
  return <AnalysisContentRenderer content={content} />;
 }

 let data: { recursosAdmissibilidade: RecursosAdmissibilidade } | null = null;

 try {
  data = JSON.parse(content);
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!data?.recursosAdmissibilidade) {
  return <AnalysisContentRenderer content={content} />;
 }

 const { recursosAdmissibilidade } = data;

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {recursosAdmissibilidade.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {isNonEmptyArray(recursosAdmissibilidade.secoes) && recursosAdmissibilidade.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     {/* Título da Seção */}
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {/* Recursos Identificados */}
     {secao.listaRecursosIdentificados && secao.listaRecursosIdentificados.length > 0 && (
      <div className="space-y-4">
       {secao.listaRecursosIdentificados.map((recurso, index) => (
        <div
         key={recurso.id}
         className="bg-theme-card border border-theme-border rounded-lg overflow-hidden"
        >
         {/* Cabeçalho do Recurso */}
         <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-theme-border">
          <div className="flex items-center gap-3">
           <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
           <div className="flex-1">
            <h3 className="font-semibold text-theme-text-primary">
             Recurso {index + 1} - {safeToString(recurso.tipoRecurso)}
            </h3>
            {recurso.dataInterposicao && (
             <p className="text-sm text-theme-text-secondary">
              Data de Interposição: {safeToString(recurso.dataInterposicao)}
             </p>
            )}
           </div>
          </div>
         </div>

         {/* Conteúdo do Recurso */}
         <div className="p-4 space-y-4">
          {/* Grid de Informações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {recurso.paginas_referencia && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Referencia nos Autos</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recurso.paginas_referencia)}</p>
            </div>
           )}

           {recurso.tempestividade && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Tempestividade</span>
             <div className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getTempestividadeBadge(safeToString(recurso.tempestividade))}`}>
               {safeToString(recurso.tempestividade)}
              </span>
             </div>
            </div>
           )}

           {recurso.preparoComprovado && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Preparo Comprovado</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recurso.preparoComprovado)}</p>
            </div>
           )}

           {recurso.regularidadeFormal && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Regularidade Formal</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recurso.regularidadeFormal)}</p>
            </div>
           )}

           {recurso.juizoAdmissibilidade && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Juizo de Admissibilidade</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recurso.juizoAdmissibilidade)}</p>
            </div>
           )}

           {recurso.dataDecisaoAdmissibilidade && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Data Decisao Admissibilidade</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recurso.dataDecisaoAdmissibilidade)}</p>
            </div>
           )}

           {recurso.decisaoAdmissibilidadePagina && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Pagina Decisao</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recurso.decisaoAdmissibilidadePagina)}</p>
            </div>
           )}

           {recurso.situacaoAtual && (
            <div className="md:col-span-2">
             <span className="text-sm font-semibold text-theme-text-primary">Situacao Atual</span>
             <div className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getSituacaoBadge(safeToString(recurso.situacaoAtual))}`}>
               {safeToString(recurso.situacaoAtual)}
              </span>
             </div>
            </div>
           )}
          </div>

          {/* Notas */}
          {recurso.notas && (
           <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
             Notas
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {safeToString(recurso.notas)}
            </p>
           </div>
          )}
         </div>
        </div>
       ))}
      </div>
     )}

     {/* Recursos Cabíveis */}
     {secao.listaRecursosCabiveis && secao.listaRecursosCabiveis.length > 0 && (
      <div className="space-y-4">
       {secao.listaRecursosCabiveis.map((recursoCabivel, index) => (
        <div
         key={recursoCabivel.id}
         className="bg-theme-card border border-theme-border rounded-lg overflow-hidden"
        >
         {/* Cabeçalho do Recurso Cabível */}
         <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-theme-border">
          <div className="flex items-center gap-3">
           <Clock className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
           <div className="flex-1">
            <h3 className="font-semibold text-theme-text-primary">
             Recurso Cabível {index + 1} - {safeToString(recursoCabivel.recursoCabivel)}
            </h3>
            <p className="text-sm text-theme-text-secondary">
             Tipo de Decisão: {safeToString(recursoCabivel.tipoDecisaoRecorrivel)}
            </p>
           </div>
           <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getSituacaoBadge(safeToString(recursoCabivel.situacao))}`}>
            {safeToString(recursoCabivel.situacao)}
           </span>
          </div>
         </div>

         {/* Conteúdo do Recurso Cabível */}
         <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {recursoCabivel.dataDecisao && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Data da Decisao</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recursoCabivel.dataDecisao)}</p>
            </div>
           )}

           {recursoCabivel.paginas_referencia && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Referencia nos Autos</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recursoCabivel.paginas_referencia)}</p>
            </div>
           )}

           {recursoCabivel.prazoLegal && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Prazo Legal</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recursoCabivel.prazoLegal)}</p>
            </div>
           )}

           {recursoCabivel.baseLegal && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Base Legal</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recursoCabivel.baseLegal)}</p>
            </div>
           )}

           {recursoCabivel.dataFinalInterposicao && (
            <div>
             <span className="text-sm font-semibold text-theme-text-primary">Data Final Interposicao</span>
             <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{safeToString(recursoCabivel.dataFinalInterposicao)}</p>
            </div>
           )}
          </div>

          {recursoCabivel.observacoes && (
           <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
             Observacoes
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {safeToString(recursoCabivel.observacoes)}
            </p>
           </div>
          )}
         </div>
        </div>
       ))}
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
