import React from 'react';
import { VisaoGeralProcessoView } from './VisaoGeralProcessoView';
import { ResumoEstrategicoView } from './ResumoEstrategicoView';
import { ComunicacoesPrazosView } from './ComunicacoesPrazosView';
import { AdmissibilidadeRecursalView } from './AdmissibilidadeRecursalView';
import { EstrategiasJuridicasView } from './EstrategiasJuridicasView';
import { RiscosAlertasView } from './RiscosAlertasView';
import { BalancoFinanceiroView } from './BalancoFinanceiroView';
import { MapaPreclusoesView } from './MapaPreclusoesView';
import { ConclusoesPerspettivasView } from './ConclusoesPerspecttivasView';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';
import { validateAndSanitizeJson } from '../../utils/jsonValidator';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AnalysisViewSelectorProps {
 title: string;
 content: string;
}

export function AnalysisViewSelector({ title, content }: AnalysisViewSelectorProps) {
 const validation = validateAndSanitizeJson(content);

 if (validation.isEmpty) {
  return (
   <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg">
    <div className="flex items-start gap-3">
     <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
     <div>
      <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
       Conteúdo não disponível
      </h3>
      <p className="text-sm text-yellow-700 dark:text-yellow-300">
       Houve um problema ao processar este item. Por favor, reprocesse o arquivo.
      </p>
     </div>
    </div>
   </div>
  );
 }

 if (!validation.isValid) {
  return (
   <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
    <div className="flex items-start gap-3">
     <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
     <div>
      <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
       Erro ao processar análise
      </h3>
      <p className="text-sm text-red-700 dark:text-red-300 mb-2">
       {validation.error || 'O conteúdo da análise está corrompido ou incompleto.'}
      </p>
      {validation.isTruncated && (
       <p className="text-sm text-red-600 dark:text-red-400">
        O conteúdo foi interrompido durante a geração. Recomendamos reprocessar o arquivo.
       </p>
      )}
     </div>
    </div>
   </div>
  );
 }

 const sanitizedContent = validation.sanitizedContent || content;
 const normalizedTitle = title.toLowerCase().trim();

 if (normalizedTitle.includes('visão geral')) {
  return <VisaoGeralProcessoView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('resumo estratégico')) {
  return <ResumoEstrategicoView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('comunicações') && normalizedTitle.includes('prazos')) {
  return <ComunicacoesPrazosView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('admissibilidade')) {
  return <AdmissibilidadeRecursalView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('estratégias') && normalizedTitle.includes('jurídicas')) {
  return <EstrategiasJuridicasView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('riscos') && normalizedTitle.includes('alertas')) {
  return <RiscosAlertasView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('balanço') && normalizedTitle.includes('financeiro')) {
  return <BalancoFinanceiroView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('mapa') && normalizedTitle.includes('preclusões')) {
  return <MapaPreclusoesView content={sanitizedContent} />;
 }

 if (normalizedTitle.includes('conclusões') || normalizedTitle.includes('perspectivas')) {
  return <ConclusoesPerspettivasView content={sanitizedContent} />;
 }

 return <AnalysisContentRenderer content={sanitizedContent} />;
}
