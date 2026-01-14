import { Clock, AlertTriangle, Calendar, FileText, Zap, Scale, Info, Target, CheckCircle, XCircle, Hourglass, Lightbulb, TrendingUp } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';
import { normalizeGenericView } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface BaseDocumental {
 arquivo?: string;
 pagina?: string;
 eventoNoSistema?: string;
}

interface PreclusaoRecente {
 id: string;
 tipo?: string;
 atoOuFaseAtingida?: string;
 poloAfetado?: string;
 dataInicioPrazo?: string;
 dataFinalPrazo?: string;
 baseLegal?: string;
 consequenciaPratica?: string;
 acaoRecomendada?: string;
 statusPrazo?: string;
 paginasReferencia?: string;
 observacoes?: string;
}

interface RiscoImediato {
 id: string;
 atoOuFase?: string;
 poloAfetado?: string;
 prazoFinalEstimado?: string;
 urgencia?: string;
 acaoRecomendada?: string;
 baseLegal?: string;
 baseDocumental?: BaseDocumental;
 observacoes?: string;
}

interface AnaliseGlobal {
 totalPreclusoesRecentes?: number;
 totalRiscosImediatos?: number;
 analiseImpactoEstrategico?: string;
 oportunidadesAlegacao?: string;
 acoesPrioritariasGerais?: string;
}

interface Secao {
 id: string;
 titulo: string;
 listaPreclusoesRecentes?: PreclusaoRecente[];
 listaRiscosImediatos?: RiscoImediato[];
 analiseGlobal?: AnaliseGlobal;
 observacoes?: string;
}

interface MapaPreclusoesProcessuais {
 titulo: string;
 secoes: Secao[];
}

interface MapaPreclusoesViewProps {
 content: string;
}

const getTipoBadge = (tipo: string | undefined) => {
 if (safeIncludes(tipo, 'temporal')) {
  return { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700', icon: Clock };
 }
 if (safeIncludes(tipo, 'consumativa')) {
  return { bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-700', icon: Zap };
 }
 if (safeIncludes(tipo, 'lógica') || safeIncludes(tipo, 'logica')) {
  return { bg: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-700', icon: Scale };
 }
 return { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border', icon: Info };
};

const getUrgenciaBadge = (urgencia: string | undefined) => {
 if (safeIncludes(urgencia, 'imediata')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (safeIncludes(urgencia, 'próxima') || safeIncludes(urgencia, 'proxima')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
};

const getStatusPrazoBadge = (status: string | undefined) => {
 if (safeIncludes(status, 'esgotado')) {
  return { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700', icon: XCircle };
 }
 if (safeIncludes(status, 'cumprido')) {
  return { bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700', icon: CheckCircle };
 }
 if (safeIncludes(status, 'não iniciado') || safeIncludes(status, 'nao iniciado')) {
  return { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border', icon: Hourglass };
 }
 return { bg: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600', icon: null };
};

export function MapaPreclusoesView({ content }: MapaPreclusoesViewProps) {
 const normalizationResult = normalizeGenericView(content, 'mapaPreclusoesProcessuais', ['mapa_preclusoes_processuais', 'mapaPreclusoes', 'mapa_preclusoes', 'preclusoes']);

 if (!normalizationResult.success) {
  return <AnalysisContentRenderer content={content} />;
 }

 let parsedData: { mapaPreclusoesProcessuais?: MapaPreclusoesProcessuais } | null = null;
 let mapaPreclusoesProcessuais: MapaPreclusoesProcessuais | null = null;

 try {
  let cleanContent = content.trim();

  if (cleanContent.startsWith('```json')) {
   cleanContent = cleanContent.substring(7);
  } else if (cleanContent.startsWith('```')) {
   cleanContent = cleanContent.substring(3);
  }

  if (cleanContent.endsWith('```')) {
   cleanContent = cleanContent.substring(0, cleanContent.length - 3);
  }

  cleanContent = cleanContent.trim();

  parsedData = JSON.parse(cleanContent);

  if (parsedData?.mapaPreclusoesProcessuais) {
   mapaPreclusoesProcessuais = parsedData.mapaPreclusoesProcessuais;
  } else if ((parsedData as MapaPreclusoesProcessuais)?.titulo && (parsedData as MapaPreclusoesProcessuais)?.secoes) {
   mapaPreclusoesProcessuais = parsedData as unknown as MapaPreclusoesProcessuais;
  }
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!mapaPreclusoesProcessuais || !mapaPreclusoesProcessuais.titulo || !mapaPreclusoesProcessuais.secoes) {
  return <AnalysisContentRenderer content={content} />;
 }

 const renderBaseDocumental = (base?: BaseDocumental) => {
  if (!base) return null;

  const hasData = base.arquivo || base.pagina || base.eventoNoSistema;
  if (!hasData) return null;

  return (
   <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border mt-4">
    <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
     <FileText className="w-4 h-4" />
     Base Documental
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
     {base.arquivo && (
      <div>
       <span className="text-xs font-semibold text-theme-text-secondary uppercase">Arquivo</span>
       <p className="text-sm text-theme-text-primary mt-0.5">{base.arquivo}</p>
      </div>
     )}
     {base.pagina && (
      <div>
       <span className="text-xs font-semibold text-theme-text-secondary uppercase">Pagina</span>
       <p className="text-sm text-theme-text-primary mt-0.5">{base.pagina}</p>
      </div>
     )}
     {base.eventoNoSistema && (
      <div>
       <span className="text-xs font-semibold text-theme-text-secondary uppercase">Evento</span>
       <p className="text-sm text-theme-text-primary mt-0.5">{base.eventoNoSistema}</p>
      </div>
     )}
    </div>
   </div>
  );
 };

 const renderObservacoes = (observacoes?: string) => {
  if (!observacoes) return null;

  return (
   <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border mt-4">
    <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
     Observacoes
    </h4>
    <p className="text-sm text-theme-text-primary leading-relaxed">
     {observacoes}
    </p>
   </div>
  );
 };

 const renderAnaliseGlobal = (analiseGlobal: AnaliseGlobal) => {
  return (
   <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
     {analiseGlobal.totalPreclusoesRecentes !== null && analiseGlobal.totalPreclusoesRecentes !== undefined && (
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-lg p-6 border border-amber-200 dark:border-amber-700">
       <div className="flex items-center justify-between">
        <div>
         <h4 className="text-sm font-semibold text-theme-text-secondary uppercase tracking-wide mb-1">
          Total Preclusoes Recentes
         </h4>
         <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
          {analiseGlobal.totalPreclusoesRecentes}
         </p>
        </div>
        <AlertTriangle className="w-12 h-12 text-amber-600 dark:text-amber-400 opacity-50" />
       </div>
      </div>
     )}

     {analiseGlobal.totalRiscosImediatos !== null && analiseGlobal.totalRiscosImediatos !== undefined && (
      <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-lg p-6 border border-red-200 dark:border-red-700">
       <div className="flex items-center justify-between">
        <div>
         <h4 className="text-sm font-semibold text-theme-text-secondary uppercase tracking-wide mb-1">
          Total Riscos Imediatos
         </h4>
         <p className="text-3xl font-bold text-red-700 dark:text-red-300">
          {analiseGlobal.totalRiscosImediatos}
         </p>
        </div>
        <Clock className="w-12 h-12 text-red-600 dark:text-red-400 opacity-50" />
       </div>
      </div>
     )}
    </div>

    {analiseGlobal.analiseImpactoEstrategico && (
     <div className="bg-theme-card rounded-lg p-5 border border-theme-border">
      <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
       <TrendingUp className="w-4 h-4" />
       Analise de Impacto Estrategico
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {analiseGlobal.analiseImpactoEstrategico}
      </p>
     </div>
    )}

    {analiseGlobal.oportunidadesAlegacao && (
     <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-5 border border-green-200 dark:border-theme-border">
      <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
       <Lightbulb className="w-4 h-4 text-green-600 dark:text-green-400" />
       Oportunidades de Alegacao
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {analiseGlobal.oportunidadesAlegacao}
      </p>
     </div>
    )}

    {analiseGlobal.acoesPrioritariasGerais && (
     <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-5 border border-blue-200 dark:border-theme-border">
      <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
       <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
       Acoes Prioritarias Gerais
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {analiseGlobal.acoesPrioritariasGerais}
      </p>
     </div>
    )}
   </div>
  );
 };

 return (
  <div className="space-y-6">
   <h1 className="text-2xl font-bold text-theme-text-primary flex items-center gap-3">
    <Clock className="w-8 h-8 text-red-600 dark:text-red-400" />
    {mapaPreclusoesProcessuais.titulo}
   </h1>

   {isNonEmptyArray(mapaPreclusoesProcessuais.secoes) && mapaPreclusoesProcessuais.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {isNonEmptyArray(secao.listaPreclusoesRecentes) && (
      <div className="space-y-4">
       {secao.listaPreclusoesRecentes.map((preclusao, index) => {
        const tipoBadge = getTipoBadge(preclusao.tipo);
        const IconeTipo = tipoBadge.icon;
        const statusBadge = getStatusPrazoBadge(preclusao.statusPrazo);
        const StatusIcon = statusBadge.icon;

        return (
         <div
          key={preclusao.id}
          className="bg-theme-card border-l-4 border-amber-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-amber-50 dark:bg-gray-700/50 px-4 py-3 border-b border-amber-200 dark:border-theme-border">
           <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
             <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
             <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
               <h3 className="font-semibold text-theme-text-primary">
                Preclusao {index + 1}
               </h3>
               {preclusao.tipo && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${tipoBadge.bg}`}>
                 <IconeTipo className="w-3 h-3" />
                 {preclusao.tipo}
                </span>
               )}
               {preclusao.statusPrazo && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${statusBadge.bg}`}>
                 {StatusIcon && <StatusIcon className="w-3 h-3" />}
                 {preclusao.statusPrazo}
                </span>
               )}
              </div>
              {preclusao.poloAfetado && (
               <p className="text-sm text-theme-text-secondary">
                Polo Afetado: {preclusao.poloAfetado}
               </p>
              )}
             </div>
            </div>
           </div>
          </div>

          <div className="p-4 space-y-4">
           {preclusao.atoOuFaseAtingida && (
            <div className="bg-amber-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
              Ato ou Fase Atingida
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {preclusao.atoOuFaseAtingida}
             </p>
            </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {preclusao.dataInicioPrazo && (
             <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border">
              <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide block mb-1 flex items-center gap-1">
               <Calendar className="w-3 h-3" />
               Data de Inicio do Prazo
              </span>
              <p className="text-sm text-theme-text-primary font-medium">{preclusao.dataInicioPrazo}</p>
             </div>
            )}
            {preclusao.dataFinalPrazo && (
             <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border">
              <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide block mb-1 flex items-center gap-1">
               <Calendar className="w-3 h-3" />
               Data Final do Prazo
              </span>
              <p className="text-sm text-theme-text-primary font-medium">{preclusao.dataFinalPrazo}</p>
             </div>
            )}
           </div>

           {preclusao.baseLegal && (
            <div className="bg-teal-50 dark:bg-gray-700/30 rounded-lg p-4 border border-teal-200 dark:border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Base Legal
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {preclusao.baseLegal}
             </p>
            </div>
           )}

           {preclusao.consequenciaPratica && (
            <div className="bg-red-50 dark:bg-gray-700/30 rounded-lg p-4 border border-red-200 dark:border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              Consequencia Pratica
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {preclusao.consequenciaPratica}
             </p>
            </div>
           )}

           {preclusao.acaoRecomendada && (
            <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 border border-green-200 dark:border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
              Acao Recomendada
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {preclusao.acaoRecomendada}
             </p>
            </div>
           )}

           {preclusao.paginasReferencia && (
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border">
             <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide block mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Referencia
             </span>
             <p className="text-sm text-theme-text-primary">{preclusao.paginasReferencia}</p>
            </div>
           )}

           {renderObservacoes(preclusao.observacoes)}
          </div>
         </div>
        );
       })}
      </div>
     )}

     {isNonEmptyArray(secao.listaRiscosImediatos) && (
      <div className="space-y-4">
       {secao.listaRiscosImediatos.map((risco, index) => (
        <div
         key={risco.id}
         className="bg-theme-card border-l-4 border-red-500 rounded-r-lg overflow-hidden"
        >
         <div className="bg-red-50 dark:bg-gray-700/50 px-4 py-3 border-b border-red-200 dark:border-theme-border">
          <div className="flex items-start justify-between gap-3">
           <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
             <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-theme-text-primary">
               Risco {index + 1}
              </h3>
             </div>
             {risco.poloAfetado && (
              <p className="text-sm text-theme-text-secondary">
               Polo Afetado: {risco.poloAfetado}
              </p>
             )}
            </div>
           </div>
           {risco.urgencia && (
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getUrgenciaBadge(risco.urgencia)}`}>
             {risco.urgencia}
            </span>
           )}
          </div>
         </div>

         <div className="p-4 space-y-4">
          {risco.atoOuFase && (
           <div className="bg-red-50 dark:bg-gray-700/30 rounded-lg p-4 border border-red-200 dark:border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
             Ato ou Fase em Risco
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {risco.atoOuFase}
            </p>
           </div>
          )}

          {risco.prazoFinalEstimado && (
           <div className="bg-amber-50 dark:bg-gray-700/30 rounded-lg p-4 border border-amber-200 dark:border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
             <Calendar className="w-4 h-4" />
             Prazo Final Estimado
            </h4>
            <p className="text-lg text-amber-700 dark:text-amber-300 font-bold">
             {risco.prazoFinalEstimado}
            </p>
           </div>
          )}

          {risco.acaoRecomendada && (
           <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 border border-green-200 dark:border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
             <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
             Acao Recomendada
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {risco.acaoRecomendada}
            </p>
           </div>
          )}

          {risco.baseLegal && (
           <div className="bg-teal-50 dark:bg-gray-700/30 rounded-lg p-4 border border-teal-200 dark:border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
             <Scale className="w-4 h-4" />
             Base Legal
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {risco.baseLegal}
            </p>
           </div>
          )}

          {renderBaseDocumental(risco.baseDocumental)}
          {renderObservacoes(risco.observacoes)}
         </div>
        </div>
       ))}
      </div>
     )}

     {secao.analiseGlobal && renderAnaliseGlobal(secao.analiseGlobal)}

     {renderObservacoes(secao.observacoes)}
    </div>
   ))}
  </div>
 );
}
