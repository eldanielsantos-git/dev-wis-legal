import { Target, Lightbulb, TrendingUp, Info, AlertCircle, Sparkles, ShieldAlert } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';
import { normalizeGenericView } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface EstrategiaPrincipal {
 descricao?: string;
 fundamentacaoLegal?: string;
 finalidadePratica?: string;
 riscoProcessual?: string;
 custoEstimado?: string;
 prioridade?: string;
 paginasReferencia?: string;
}

interface EstrategiaComplementar {
 id: string;
 descricao?: string;
 condicaoAdocao?: string;
 fundamentacaoLegal?: string;
 finalidadePratica?: string;
 riscoProcessual?: string;
 prioridade?: string;
 paginasReferencia?: string;
}

interface EstrategiaPolo {
 id: string;
 polo: string;
 situacaoAtualPolo?: string;
 estrategiaPrincipal?: EstrategiaPrincipal;
 estrategiasComplementares?: EstrategiaComplementar[];
}

interface AnaliseGlobal {
 sinteseEstrategica?: string;
 pontosAtencaoCriticos?: string;
 oportunidadesJuridicasGerais?: string;
 riscosGeraisIdentificados?: string;
}

interface Secao {
 id: string;
 titulo: string;
 listaEstrategias?: EstrategiaPolo[];
 analiseGlobal?: AnaliseGlobal;
}

interface EstrategiasJuridicas {
 titulo: string;
 secoes: Secao[];
}

interface EstrategiasJuridicasViewProps {
 content: string;
}

const getRiscoBadge = (risco: string | undefined) => {
 if (safeIncludes(risco, 'baixo')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(risco, 'médio') || safeIncludes(risco, 'medio')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(risco, 'alto')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getCustoBadge = (custo: string | undefined) => {
 if (safeIncludes(custo, 'baixo')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(custo, 'médio') || safeIncludes(custo, 'medio')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (safeIncludes(custo, 'alto')) {
  return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getPrioridadeBadge = (prioridade: string | undefined) => {
 if (safeIncludes(prioridade, 'principal')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(prioridade, 'secundária') || safeIncludes(prioridade, 'secundaria')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (safeIncludes(prioridade, 'contingente')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(prioridade, 'oportunista')) {
  return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getPoloColor = (polo: string | undefined) => {
 if (safeIncludes(polo, 'autor')) {
  return {
   bg: 'bg-theme-bg-tertiary',
   border: 'border-blue-200 dark:border-theme-border',
   icon: 'text-blue-600 dark:text-blue-400'
  };
 }
 if (safeIncludes(polo, 'réu') || safeIncludes(polo, 'reu')) {
  return {
   bg: 'bg-orange-50 dark:bg-gray-700/50',
   border: 'border-orange-100 dark:border-theme-border',
   icon: 'text-orange-600 dark:text-orange-400'
  };
 }
 return {
  bg: 'bg-teal-50 dark:bg-gray-700/50',
  border: 'border-teal-200 dark:border-theme-border',
  icon: 'text-teal-600 dark:text-teal-400'
 };
};

export function EstrategiasJuridicasView({ content }: EstrategiasJuridicasViewProps) {
 const normalizationResult = normalizeGenericView(content, 'estrategiasJuridicas', ['estrategias_juridicas', 'estrategias']);

 if (!normalizationResult.success) {
  return <AnalysisContentRenderer content={content} />;
 }

 let data: { estrategiasJuridicas: EstrategiasJuridicas } | null = null;

 try {
  let cleanContent = content.trim();

  if (cleanContent.startsWith('```json')) {
   cleanContent = cleanContent.substring(7);
  }
  if (cleanContent.startsWith('```')) {
   cleanContent = cleanContent.substring(3);
  }

  const lastTripleBacktick = cleanContent.lastIndexOf('```');
  if (lastTripleBacktick > 0) {
   cleanContent = cleanContent.substring(0, lastTripleBacktick);
  }

  cleanContent = cleanContent.trim();

  data = JSON.parse(cleanContent);
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!data?.estrategiasJuridicas) {
  return <AnalysisContentRenderer content={content} />;
 }

 const { estrategiasJuridicas } = data;

 return (
  <div className="space-y-6">
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {estrategiasJuridicas.titulo}
   </h1>

   {isNonEmptyArray(estrategiasJuridicas.secoes) && estrategiasJuridicas.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {isNonEmptyArray(secao.listaEstrategias) && (
      <div className="space-y-6">
       {secao.listaEstrategias.map((estrategia) => {
        const poloColors = getPoloColor(estrategia.polo);

        return (
         <div
          key={estrategia.id}
          className="bg-theme-card border border-theme-border rounded-lg overflow-hidden"
         >
          <div className={`${poloColors.bg} px-4 py-3 border-b ${poloColors.border}`}>
           <div className="flex items-center gap-3">
            <Target className={`w-5 h-5 ${poloColors.icon} flex-shrink-0`} />
            <h3 className="font-semibold text-theme-text-primary text-lg">
             {estrategia.polo}
            </h3>
           </div>
          </div>

          <div className="p-4 space-y-5">
           {estrategia.situacaoAtualPolo && (
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
              Situacao Atual
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {estrategia.situacaoAtualPolo}
             </p>
            </div>
           )}

           {estrategia.estrategiaPrincipal && (
            <div className="border-l-4 border-green-500 bg-green-50 dark:bg-gray-700/30 rounded-r-lg p-4">
             <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h4 className="text-base font-bold text-theme-text-primary">
               Estrategia Principal
              </h4>
              {estrategia.estrategiaPrincipal.prioridade && (
               <span className={`ml-auto inline-flex px-2 py-1 text-xs font-medium rounded border ${getPrioridadeBadge(estrategia.estrategiaPrincipal.prioridade)}`}>
                {estrategia.estrategiaPrincipal.prioridade}
               </span>
              )}
             </div>

             <div className="space-y-3">
              {estrategia.estrategiaPrincipal.descricao && (
               <div>
                <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                 Descricao
                </span>
                <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                 {estrategia.estrategiaPrincipal.descricao}
                </p>
               </div>
              )}

              {estrategia.estrategiaPrincipal.fundamentacaoLegal && (
               <div>
                <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                 Fundamentacao Legal
                </span>
                <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                 {estrategia.estrategiaPrincipal.fundamentacaoLegal}
                </p>
               </div>
              )}

              {estrategia.estrategiaPrincipal.finalidadePratica && (
               <div>
                <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                 Finalidade Pratica
                </span>
                <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                 {estrategia.estrategiaPrincipal.finalidadePratica}
                </p>
               </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
               {estrategia.estrategiaPrincipal.riscoProcessual && (
                <div>
                 <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                  Risco Processual
                 </span>
                 <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getRiscoBadge(estrategia.estrategiaPrincipal.riscoProcessual)}`}>
                  {estrategia.estrategiaPrincipal.riscoProcessual}
                 </span>
                </div>
               )}
               {estrategia.estrategiaPrincipal.custoEstimado && (
                <div>
                 <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                  Custo Estimado
                 </span>
                 <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getCustoBadge(estrategia.estrategiaPrincipal.custoEstimado)}`}>
                  {estrategia.estrategiaPrincipal.custoEstimado}
                 </span>
                </div>
               )}
               {estrategia.estrategiaPrincipal.paginasReferencia && (
                <div>
                 <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                  Referencia
                 </span>
                 <span className="inline-flex px-2 py-1 text-xs font-medium rounded border bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border">
                  {estrategia.estrategiaPrincipal.paginasReferencia}
                 </span>
                </div>
               )}
              </div>
             </div>
            </div>
           )}

           {isNonEmptyArray(estrategia.estrategiasComplementares) && (
            <div className="space-y-3">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Estrategias Complementares
             </h4>

             {estrategia.estrategiasComplementares.map((comp, index) => (
              <div
               key={comp.id}
               className="border-l-4 border-blue-500 bg-blue-50 dark:bg-gray-700/30 rounded-r-lg p-4"
              >
               <div className="flex items-start justify-between gap-3 mb-3">
                <h5 className="text-sm font-bold text-theme-text-primary">
                 Estrategia Complementar #{index + 1}
                </h5>
                {comp.prioridade && (
                 <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getPrioridadeBadge(comp.prioridade)}`}>
                  {comp.prioridade}
                 </span>
                )}
               </div>

               <div className="space-y-3">
                {comp.descricao && (
                 <div>
                  <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                   Descricao
                  </span>
                  <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                   {comp.descricao}
                  </p>
                 </div>
                )}

                {comp.condicaoAdocao && (
                 <div>
                  <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                   Condicao de Adocao
                  </span>
                  <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                   {comp.condicaoAdocao}
                  </p>
                 </div>
                )}

                {comp.fundamentacaoLegal && (
                 <div>
                  <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                   Fundamentacao Legal
                  </span>
                  <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                   {comp.fundamentacaoLegal}
                  </p>
                 </div>
                )}

                {comp.finalidadePratica && (
                 <div>
                  <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                   Finalidade Pratica
                  </span>
                  <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                   {comp.finalidadePratica}
                  </p>
                 </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                 {comp.riscoProcessual && (
                  <div>
                   <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                    Risco Processual
                   </span>
                   <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getRiscoBadge(comp.riscoProcessual)}`}>
                    {comp.riscoProcessual}
                   </span>
                  </div>
                 )}
                 {comp.paginasReferencia && (
                  <div>
                   <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                    Referencia
                   </span>
                   <span className="inline-flex px-2 py-1 text-xs font-medium rounded border bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border">
                    {comp.paginasReferencia}
                   </span>
                  </div>
                 )}
                </div>
               </div>
              </div>
             ))}
            </div>
           )}
          </div>
         </div>
        );
       })}
      </div>
     )}

     {secao.analiseGlobal && (
      <div className="space-y-4">
       {secao.analiseGlobal.sinteseEstrategica && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-700/50 rounded-lg p-5 border border-theme-border">
         <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-2">
            Sintese Estrategica
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {secao.analiseGlobal.sinteseEstrategica}
           </p>
          </div>
         </div>
        </div>
       )}

       {secao.analiseGlobal.pontosAtencaoCriticos && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-gray-800 dark:to-gray-700/50 rounded-lg p-5 border border-amber-200 dark:border-theme-border">
         <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-2">
            Pontos de Atencao Criticos
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {secao.analiseGlobal.pontosAtencaoCriticos}
           </p>
          </div>
         </div>
        </div>
       )}

       {secao.analiseGlobal.oportunidadesJuridicasGerais && (
        <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-gray-800 dark:to-gray-700/50 rounded-lg p-5 border border-green-200 dark:border-theme-border">
         <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-2">
            Oportunidades Juridicas Gerais
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {secao.analiseGlobal.oportunidadesJuridicasGerais}
           </p>
          </div>
         </div>
        </div>
       )}

       {secao.analiseGlobal.riscosGeraisIdentificados && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-gray-800 dark:to-gray-700/50 rounded-lg p-5 border border-red-200 dark:border-theme-border">
         <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-2">
            Riscos Gerais Identificados
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {secao.analiseGlobal.riscosGeraisIdentificados}
           </p>
          </div>
         </div>
        </div>
       )}
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
