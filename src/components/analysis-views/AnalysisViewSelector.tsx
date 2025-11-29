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

  const isRiscos = title?.toLowerCase().includes('riscos');

  if (isRiscos) {
   console.log('🔍 RISCOS - AnalysisViewSelector validation:', {
    title,
    validation,
    contentLength: content?.length,
    firstChars: content?.substring(0, 100)
   });
  }

  if (validation.isEmpty) {
   if (isRiscos) console.log('❌ RISCOS - Content is empty');
   return null;
  }

  if (!validation.isValid) {
   if (isRiscos) console.error('❌ RISCOS - Validation failed:', title, validation.error);
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
  console.log('✅ Matched Riscos e Alertas!', {
   title,
   normalizedTitle,
   sanitizedLength: sanitizedContent.length,
   firstChars: sanitizedContent.substring(0, 200)
  });
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
