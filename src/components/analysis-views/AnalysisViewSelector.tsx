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
 try {
  const validation = validateAndSanitizeJson(content);

  console.log('🔍 AnalysisViewSelector validation:', { title, validation, contentLength: content?.length });

  if (validation.isEmpty) {
   return null;
  }

  if (!validation.isValid) {
   console.error('❌ Validation failed for:', title, validation.error);
   return null;
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
 } catch (error) {
  console.error('❌ Error in AnalysisViewSelector:', { title, error });
  return null;
 }
}
