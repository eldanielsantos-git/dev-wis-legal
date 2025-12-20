import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { logger } from './logger';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

function isNetworkError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';

  return (
    errorMessage.includes('fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('quic') ||
    errorMessage.includes('protocol_error') ||
    errorMessage.includes('connection') ||
    errorCode.includes('network') ||
    errorCode.includes('econnrefused') ||
    errorCode.includes('etimedout')
  );
}

function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWithRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation();

      if (result.error && isNetworkError(result.error)) {
        lastError = result.error;

        if (attempt < config.maxRetries) {
          const delay = calculateDelay(
            attempt,
            config.initialDelayMs,
            config.maxDelayMs,
            config.backoffMultiplier
          );

          logger.warn(
            'SupabaseRetry',
            `Erro de rede detectado (tentativa ${attempt + 1}/${config.maxRetries + 1}). Tentando novamente em ${delay}ms...`
          );

          await sleep(delay);
          continue;
        }

        logger.error(
          'SupabaseRetry',
          `Todas as tentativas falharam após ${config.maxRetries + 1} tentativas`
        );
        return result;
      }

      if (attempt > 0) {
        logger.log('SupabaseRetry', `Operação bem-sucedida após ${attempt + 1} tentativas`);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (isNetworkError(error) && attempt < config.maxRetries) {
        const delay = calculateDelay(
          attempt,
          config.initialDelayMs,
          config.maxDelayMs,
          config.backoffMultiplier
        );

        logger.warn(
          'SupabaseRetry',
          `Exceção de rede detectada (tentativa ${attempt + 1}/${config.maxRetries + 1}). Tentando novamente em ${delay}ms...`
        );

        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  return { data: null, error: lastError };
}

export function wrapQueryWithRetry<T>(
  queryBuilder: PostgrestFilterBuilder<any, any, T>,
  options?: RetryOptions
) {
  const originalMethods = {
    single: queryBuilder.single.bind(queryBuilder),
    maybeSingle: queryBuilder.maybeSingle.bind(queryBuilder),
  };

  queryBuilder.single = function () {
    const query = originalMethods.single();
    return executeWithRetry(() => query, options) as any;
  };

  queryBuilder.maybeSingle = function () {
    const query = originalMethods.maybeSingle();
    return executeWithRetry(() => query, options) as any;
  };

  return queryBuilder;
}
