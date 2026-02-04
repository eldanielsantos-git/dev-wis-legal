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
import { aggressiveClean, tryParseJSON } from '../../utils/jsonSanitizer';
import { safeExtractString } from '../../utils/typeGuards';

interface AnalysisViewSelectorProps {
 title: string;
 content: string;
}

export function AnalysisViewSelector({ title, content }: AnalysisViewSelectorProps) {
 try {
  if (!content || content.trim().length === 0) {
   return <AnalysisContentRenderer content={content || ''} />;
  }

  const validation = validateAndSanitizeJson(content);

  let sanitizedContent = content;

  if (validation.isValid && validation.sanitizedContent) {
   sanitizedContent = validation.sanitizedContent;
  } else {
   const cleaned = aggressiveClean(content);
   const parsed = tryParseJSON(cleaned);
   if (parsed !== null) {
    sanitizedContent = cleaned;
   }
  }

  const normalizedTitle = safeExtractString(title).toLowerCase().trim();

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
 } catch (error) {
  return <AnalysisContentRenderer content={content} />;
 }
}
