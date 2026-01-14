import { AlertTriangle, Shield, Clock, FileText, Target, Zap, Info, DollarSign, HelpCircle } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';
import { normalizeRiscosAlertas } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface Alerta {
 id: string;
 categoria?: string;
 descricaoRisco?: string;
 poloAfetado?: string;
 gravidade?: string;
 urgencia?: string;
 acaoRecomendada?: string;
 fundamentacaoLegal?: string;
 paginasReferencia?: string;
 observacoes?: string;
}

interface Campo {
 id: string;
 label?: string;
 valor: string | number;
}

interface Secao {
 id: string;
 titulo: string;
 listaAlertas?: Alerta[];
 campos?: Campo[];
}

interface RiscosAlertasProcessuais {
 titulo: string;
 secoes: Secao[];
}

interface RiscosAlertasViewProps {
 content: string;
}

const getGravidadeIcon = (gravidade: string | undefined) => {
 if (safeIncludes(gravidade, 'alta')) {
  return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
 }
 if (safeIncludes(gravidade, 'média') || safeIncludes(gravidade, 'media')) {
  return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
 }
 return <AlertTriangle className="w-5 h-5 text-green-600 dark:text-green-400" />;
};

const getGravidadeBadge = (gravidade: string | undefined) => {
 if (safeIncludes(gravidade, 'alta')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (safeIncludes(gravidade, 'média') || safeIncludes(gravidade, 'media')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(gravidade, 'baixa')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getUrgenciaBadge = (urgencia: string | undefined) => {
 if (safeIncludes(urgencia, 'imediata')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (safeIncludes(urgencia, 'próxima') || safeIncludes(urgencia, 'proxima')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(urgencia, 'monitoramento')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getCategoriaBadge = (categoria: string | undefined) => {
 if (safeIncludes(categoria, 'nulidade')) {
  return { bg: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-700', icon: Shield };
 }
 if (safeIncludes(categoria, 'prazos')) {
  return { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700', icon: Clock };
 }
 if (safeIncludes(categoria, 'probatório') || safeIncludes(categoria, 'probatorio')) {
  return { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700', icon: FileText };
 }
 if (safeIncludes(categoria, 'econômico') || safeIncludes(categoria, 'economico')) {
  return { bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700', icon: DollarSign };
 }
 if (safeIncludes(categoria, 'estratégico') || safeIncludes(categoria, 'estrategico')) {
  return { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700', icon: Target };
 }
 if (safeIncludes(categoria, 'outro')) {
  return { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border', icon: HelpCircle };
 }
 return { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border', icon: Info };
};

const getRiscoGlobalColor = (risco: string | undefined) => {
 if (safeIncludes(risco, 'alta')) {
  return 'bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-700/30';
 }
 if (safeIncludes(risco, 'média') || safeIncludes(risco, 'media')) {
  return 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-700/30';
 }
 if (safeIncludes(risco, 'baixa')) {
  return 'bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-700/30';
 }
 return 'bg-gray-50/50 dark:bg-gray-900/10 border-gray-200/50 dark:border-gray-700/30';
};

export function RiscosAlertasView({ content }: RiscosAlertasViewProps) {
 const normalizationResult = normalizeRiscosAlertas(content);

 if (!normalizationResult.success || !normalizationResult.data?.riscosAlertasProcessuais) {
  return <AnalysisContentRenderer content={content} />;
 }

 let data: { riscosAlertasProcessuais: RiscosAlertasProcessuais } | null = null;

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

  data = JSON.parse(cleanContent);
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!data?.riscosAlertasProcessuais) {
  return <AnalysisContentRenderer content={content} />;
 }

 const { riscosAlertasProcessuais } = data;

 return (
  <div className="space-y-6">
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {riscosAlertasProcessuais.titulo}
   </h1>

   {isNonEmptyArray(riscosAlertasProcessuais.secoes) && riscosAlertasProcessuais.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {isNonEmptyArray(secao.listaAlertas) && (
      <div className="space-y-4">
       {secao.listaAlertas.map((alerta, index) => {
        const categoriaBadge = getCategoriaBadge(alerta.categoria);
        const IconeCategoria = categoriaBadge.icon;

        return (
         <div
          key={alerta.id}
          className="bg-theme-card border-l-4 border-red-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-red-200 dark:border-theme-border">
           <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
             {getGravidadeIcon(alerta.gravidade)}
             <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
               <h3 className="font-semibold text-theme-text-primary">
                Alerta {index + 1}
               </h3>
               {alerta.categoria && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${categoriaBadge.bg}`}>
                 <IconeCategoria className="w-3 h-3" />
                 {alerta.categoria}
                </span>
               )}
              </div>
              {alerta.poloAfetado && (
               <p className="text-sm text-theme-text-secondary">
                Polo Afetado: {alerta.poloAfetado}
               </p>
              )}
             </div>
            </div>
            <div className="flex flex-col gap-3">
             {alerta.gravidade && (
              <div className="flex flex-col gap-1">
               <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
                Gravidade
               </span>
               <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getGravidadeBadge(alerta.gravidade)}`}>
                {alerta.gravidade}
               </span>
              </div>
             )}
             {alerta.urgencia && (
              <div className="flex flex-col gap-1">
               <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
                Urgencia
               </span>
               <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getUrgenciaBadge(alerta.urgencia)}`}>
                {alerta.urgencia}
               </span>
              </div>
             )}
            </div>
           </div>
          </div>

          <div className="p-4 space-y-4">
           {alerta.descricaoRisco && (
            <div className="bg-red-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Descricao do Risco
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {alerta.descricaoRisco}
             </p>
            </div>
           )}

           {alerta.acaoRecomendada && (
            <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Acao Recomendada
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {alerta.acaoRecomendada}
             </p>
            </div>
           )}

           {alerta.fundamentacaoLegal && (
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Fundamentacao Legal
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {alerta.fundamentacaoLegal}
             </p>
            </div>
           )}

           <div className="flex flex-wrap gap-3">
            {alerta.paginasReferencia && (
             <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border">
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
               Referencia
              </span>
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded border bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border">
               {alerta.paginasReferencia}
              </span>
             </div>
            )}
           </div>

           {alerta.observacoes && (
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
              Observacoes
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {alerta.observacoes}
             </p>
            </div>
           )}
          </div>
         </div>
        );
       })}
      </div>
     )}

     {isNonEmptyArray(secao.campos) && (
      <div className="space-y-4">
       {secao.campos.map((campo) => {
        const isRiscoGlobal = campo.id === 'risco_global_medio';
        const isNumeroAlertas = campo.id === 'numero_total_alertas';
        const isPontosCriticos = campo.id === 'principais_pontos_criticos';
        const isRecomendacoes = campo.id === 'recomendacoes_prioritarias';

        if (isRiscoGlobal) {
         return (
          <div
           key={campo.id}
           className={`${getRiscoGlobalColor(String(campo.valor))} rounded-lg p-4 border`}
          >
           <div className="flex items-center justify-between">
            <div>
             <h4 className="text-sm font-semibold text-theme-text-secondary mb-1">
              {campo.label}
             </h4>
             <p className="text-xl font-bold text-theme-text-primary">
              {campo.valor}
             </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-theme-text-secondary opacity-30" />
           </div>
          </div>
         );
        }

        if (isNumeroAlertas) {
         return (
          <div
           key={campo.id}
           className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200/50 dark:border-blue-700/30"
          >
           <div className="flex items-center justify-between">
            <div>
             <h4 className="text-sm font-semibold text-theme-text-secondary mb-1">
              {campo.label}
             </h4>
             <p className="text-xl font-bold text-theme-text-primary">
              {campo.valor}
             </p>
            </div>
            <Info className="w-8 h-8 text-theme-text-secondary opacity-30" />
           </div>
          </div>
         );
        }

        if (isPontosCriticos) {
         return (
          <div
           key={campo.id}
           className="bg-amber-50 dark:bg-gray-700/30 rounded-lg p-5 border border-amber-200 dark:border-theme-border"
          >
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            {campo.label}
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {campo.valor}
           </p>
          </div>
         );
        }

        if (isRecomendacoes) {
         return (
          <div
           key={campo.id}
           className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-5 border border-green-200 dark:border-theme-border"
          >
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
            {campo.label}
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {campo.valor}
           </p>
          </div>
         );
        }

        return (
         <div
          key={campo.id}
          className="bg-theme-card rounded-lg p-5 border border-theme-border"
         >
          {campo.label && (
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-3">
            {campo.label}
           </h4>
          )}
          <p className="text-sm text-theme-text-primary leading-relaxed">
           {campo.valor}
          </p>
         </div>
        );
       })}
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
