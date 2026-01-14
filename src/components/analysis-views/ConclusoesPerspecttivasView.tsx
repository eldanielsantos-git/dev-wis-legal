import { CheckCircle, AlertCircle, FileText, TrendingUp, Target, Lightbulb, Shield, Eye, Clock, BarChart3 } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';
import { normalizeGenericView } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface Completude {
 nivel?: string;
 descricao?: string;
 premissasFundamentais?: string[];
}

interface Legibilidade {
 nivel?: string;
 descricao?: string;
}

interface CoerenciaCronologica {
 status?: string;
 observacoes?: string;
}

interface AnaliseConfianca {
 nivelConfianca?: string;
 justificativa?: string;
 limitacoesAnalise?: string;
}

interface SinteseGlobal {
 situacaoAtualProcesso?: string;
 tendenciaEvolucao?: string;
 sinteseRiscosOportunidades?: string;
 proximosPassosPossiveis?: string;
 observacoesFinais?: string;
}

interface Secao {
 id: string;
 titulo: string;
 completude?: Completude;
 legibilidade?: Legibilidade;
 coerenciaCronologica?: CoerenciaCronologica;
 analiseConfianca?: AnaliseConfianca;
 sinteseGlobal?: SinteseGlobal;
}

interface ConclusoesPerspectivas {
 titulo: string;
 secoes: Secao[];
}

interface ConclusoesPerspettivasViewProps {
 content: string;
}

const getNivelBadge = (nivel: string | undefined) => {
 if (safeIncludes(nivel, 'alta')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(nivel, 'média') || safeIncludes(nivel, 'media')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(nivel, 'baixa')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getCoerenciaBadge = (status: string | undefined) => {
 if (safeIncludes(status, 'coerente') && !safeIncludes(status, 'parcialmente')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(status, 'parcialmente')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(status, 'incoerente')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getTendenciaBadge = (tendencia: string | undefined) => {
 if (safeIncludes(tendencia, 'encerramento')) {
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
 }
 if (safeIncludes(tendencia, 'continuidade')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (safeIncludes(tendencia, 'recursal')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(tendencia, 'executória') || safeIncludes(tendencia, 'executoria')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(tendencia, 'suspensão') || safeIncludes(tendencia, 'suspensao') || safeIncludes(tendencia, 'sobrestamento')) {
  return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600';
 }
 return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600';
};

export function ConclusoesPerspettivasView({ content }: ConclusoesPerspettivasViewProps) {
 const normalizationResult = normalizeGenericView(content, 'conclusoesPerspectivas', ['conclusoes_perspectivas', 'conclusoes', 'perspectivas']);

 if (!normalizationResult.success) {
  return <AnalysisContentRenderer content={content} />;
 }

 let parsedData: { conclusoesPerspectivas?: ConclusoesPerspectivas } | null = null;
 let conclusoesPerspectivas: ConclusoesPerspectivas | null = null;

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

  if (parsedData?.conclusoesPerspectivas) {
   conclusoesPerspectivas = parsedData.conclusoesPerspectivas;
  } else if ((parsedData as ConclusoesPerspectivas)?.titulo && (parsedData as ConclusoesPerspectivas)?.secoes) {
   conclusoesPerspectivas = parsedData as unknown as ConclusoesPerspectivas;
  }
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!conclusoesPerspectivas || !conclusoesPerspectivas.titulo || !conclusoesPerspectivas.secoes) {
  return <AnalysisContentRenderer content={content} />;
 }

 const renderQualidadeDocumental = (secao: Secao) => {
  return (
   <div className="bg-theme-card rounded-lg border border-theme-border overflow-hidden">
    {secao.completude && (
     <div className="p-5 border-b border-theme-border">
      <div className="flex items-center justify-between mb-3">
       <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Completude
       </h3>
       {secao.completude.nivel && (
        <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-lg border ${getNivelBadge(secao.completude.nivel)}`}>
         {secao.completude.nivel}
        </span>
       )}
      </div>
      {secao.completude.descricao && (
       <p className="text-sm text-theme-text-primary leading-relaxed mb-4">
        {secao.completude.descricao}
       </p>
      )}
      {isNonEmptyArray(secao.completude.premissasFundamentais) && (
       <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 border border-blue-200 dark:border-theme-border">
        <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
         Premissas Fundamentais
        </h4>
        <ul className="space-y-1">
         {secao.completude.premissasFundamentais.map((premissa, idx) => (
          <li key={idx} className="flex items-start gap-2">
           <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
           <span className="text-sm text-theme-text-primary">{premissa}</span>
          </li>
         ))}
        </ul>
       </div>
      )}
     </div>
    )}

    {secao.legibilidade && (
     <div className="p-5 border-b border-theme-border">
      <div className="flex items-center justify-between mb-3">
       <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
        <Eye className="w-5 h-5" />
        Legibilidade
       </h3>
       {secao.legibilidade.nivel && (
        <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-lg border ${getNivelBadge(secao.legibilidade.nivel)}`}>
         {secao.legibilidade.nivel}
        </span>
       )}
      </div>
      {secao.legibilidade.descricao && (
       <p className="text-sm text-theme-text-primary leading-relaxed">
        {secao.legibilidade.descricao}
       </p>
      )}
     </div>
    )}

    {secao.coerenciaCronologica && (
     <div className="p-5">
      <div className="flex items-center justify-between mb-3">
       <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Coerencia Cronologica
       </h3>
       {secao.coerenciaCronologica.status && (
        <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-lg border ${getCoerenciaBadge(secao.coerenciaCronologica.status)}`}>
         {secao.coerenciaCronologica.status}
        </span>
       )}
      </div>
      {secao.coerenciaCronologica.observacoes && (
       <p className="text-sm text-theme-text-primary leading-relaxed">
        {secao.coerenciaCronologica.observacoes}
       </p>
      )}
     </div>
    )}
   </div>
  );
 };

 const renderConfiancaAnalise = (analiseConfianca: AnaliseConfianca) => {
  return (
   <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-700/50 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-700/50">
    {analiseConfianca.nivelConfianca && (
     <div className="mb-4">
      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide mb-2 flex items-center gap-2">
       <BarChart3 className="w-4 h-4" />
       Nivel de Confianca
      </h4>
      <span className={`inline-flex px-4 py-2 text-base font-bold rounded-lg border ${getNivelBadge(analiseConfianca.nivelConfianca)}`}>
       {analiseConfianca.nivelConfianca}
      </span>
     </div>
    )}

    {analiseConfianca.justificativa && (
     <div className="mb-4">
      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide mb-2">
       Justificativa
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {analiseConfianca.justificativa}
      </p>
     </div>
    )}

    {analiseConfianca.limitacoesAnalise && (
     <div>
      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide mb-2 flex items-center gap-2">
       <AlertCircle className="w-4 h-4" />
       Limitacoes da Analise
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {analiseConfianca.limitacoesAnalise}
      </p>
     </div>
    )}
   </div>
  );
 };

 const renderSinteseGlobal = (sinteseGlobal: SinteseGlobal) => {
  return (
   <div className="space-y-4">
    {sinteseGlobal.situacaoAtualProcesso && (
     <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-800/30 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
      <h4 className="text-lg font-bold text-theme-text-primary mb-3 flex items-center gap-2">
       <Target className="w-5 h-5" />
       Situacao Atual do Processo
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {sinteseGlobal.situacaoAtualProcesso}
      </p>
     </div>
    )}

    {sinteseGlobal.tendenciaEvolucao && (
     <div className="bg-theme-card rounded-lg p-6 border border-theme-border">
      <h4 className="text-lg font-bold text-theme-text-primary mb-3 flex items-center gap-2">
       <TrendingUp className="w-5 h-5" />
       Tendencia de Evolucao
      </h4>
      <span className={`inline-flex px-4 py-2 text-base font-bold rounded-lg border ${getTendenciaBadge(sinteseGlobal.tendenciaEvolucao)}`}>
       {sinteseGlobal.tendenciaEvolucao}
      </span>
     </div>
    )}

    {sinteseGlobal.sinteseRiscosOportunidades && (
     <div className="bg-theme-card rounded-lg p-6 border-l-4 border-amber-500">
      <h4 className="text-lg font-bold text-theme-text-primary mb-4 flex items-center gap-2">
       <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
       Sintese de Riscos e Oportunidades
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {sinteseGlobal.sinteseRiscosOportunidades}
      </p>
     </div>
    )}

    {sinteseGlobal.proximosPassosPossiveis && (
     <div className="bg-theme-card rounded-lg p-6 border-l-4 border-green-500">
      <h4 className="text-lg font-bold text-theme-text-primary mb-4 flex items-center gap-2">
       <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
       Proximos Passos Possiveis
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {sinteseGlobal.proximosPassosPossiveis}
      </p>
     </div>
    )}

    {sinteseGlobal.observacoesFinais && (
     <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-5 border border-theme-border">
      <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-3">
       Observacoes Finais
      </h4>
      <p className="text-sm text-theme-text-primary leading-relaxed">
       {sinteseGlobal.observacoesFinais}
      </p>
     </div>
    )}
   </div>
  );
 };

 return (
  <div className="space-y-6">
   <h1 className="text-2xl font-bold text-theme-text-primary flex items-center gap-3">
    <CheckCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
    {conclusoesPerspectivas.titulo}
   </h1>

   {isNonEmptyArray(conclusoesPerspectivas.secoes) && conclusoesPerspectivas.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {secao.id === 'qualidade_documental' && (secao.completude || secao.legibilidade || secao.coerenciaCronologica) && (
      renderQualidadeDocumental(secao)
     )}

     {secao.id === 'confianca_analise' && secao.analiseConfianca && (
      renderConfiancaAnalise(secao.analiseConfianca)
     )}

     {secao.id === 'conclusoes_perspectivas_finais' && secao.sinteseGlobal && (
      renderSinteseGlobal(secao.sinteseGlobal)
     )}
    </div>
   ))}
  </div>
 );
}
