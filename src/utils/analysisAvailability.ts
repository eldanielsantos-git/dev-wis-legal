import type { AnalysisResult } from '../lib/supabase';

export interface CardAvailability {
  cardId: string;
  executionOrder: number;
  isAvailable: boolean;
  isCompleted: boolean;
  title: string;
}

export function calculateCardAvailability(
  analysisResults: AnalysisResult[]
): Map<string, CardAvailability> {
  const availabilityMap = new Map<string, CardAvailability>();

  const sortedResults = [...analysisResults].sort(
    (a, b) => a.execution_order - b.execution_order
  );

  sortedResults.forEach((result) => {
    const isCompleted = result.status === 'completed';

    // Todos os cards completados estão disponíveis (não há mais bloqueio sequencial no frontend)
    const isAvailable = isCompleted;

    availabilityMap.set(result.id, {
      cardId: result.id,
      executionOrder: result.execution_order,
      isAvailable,
      isCompleted,
      title: result.prompt_title,
    });
  });

  return availabilityMap;
}

export function getAvailableCards(
  analysisResults: AnalysisResult[]
): AnalysisResult[] {
  // Retorna todos os cards completados (sem bloqueio sequencial no frontend)
  return analysisResults
    .filter(result => result.status === 'completed')
    .sort((a, b) => a.execution_order - b.execution_order);
}

export function isCardAvailable(
  cardId: string,
  analysisResults: AnalysisResult[]
): boolean {
  const availabilityMap = calculateCardAvailability(analysisResults);
  const cardAvailability = availabilityMap.get(cardId);
  return cardAvailability?.isAvailable || false;
}

export function getNextAvailableCard(
  analysisResults: AnalysisResult[]
): AnalysisResult | null {
  const sortedResults = [...analysisResults].sort(
    (a, b) => a.execution_order - b.execution_order
  );

  let lastCompletedOrder = 0;

  for (const result of sortedResults) {
    if (result.status === 'completed') {
      lastCompletedOrder = result.execution_order;
    } else if (result.execution_order === lastCompletedOrder + 1) {
      return result;
    }
  }

  return null;
}
