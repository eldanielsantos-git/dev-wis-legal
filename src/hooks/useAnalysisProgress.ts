import { useState, useEffect } from 'react';
import { AnalysisService } from '../services/AnalysisService';

interface AnalysisProgress {
  currentPrompt: number;
  totalPrompts: number;
  status: string;
  percentage: number;
}

export function useAnalysisProgress(processoId: string | null) {
  const [progress, setProgress] = useState<AnalysisProgress>({
    currentPrompt: 0,
    totalPrompts: 9,
    status: 'created',
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!processoId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    async function loadProgress() {
      try {
        const data = await AnalysisService.getAnalysisProgress(processoId);

        const percentage =
          data.totalPrompts > 0
            ? Math.round((data.currentPrompt / data.totalPrompts) * 100)
            : 0;

        setProgress({
          currentPrompt: data.currentPrompt,
          totalPrompts: data.totalPrompts,
          status: data.status,
          percentage,
        });

        unsubscribe = AnalysisService.subscribeToAnalysisProgress(
          processoId,
          (updatedProgress) => {
            const updatedPercentage =
              updatedProgress.totalPrompts > 0
                ? Math.round(
                    (updatedProgress.currentPrompt / updatedProgress.totalPrompts) * 100
                  )
                : 0;

            setProgress({
              ...updatedProgress,
              percentage: updatedPercentage,
            });
          }
        );

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar progresso');
        setLoading(false);
      }
    }

    loadProgress();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [processoId]);

  return { progress, loading, error };
}
