import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const HEARTBEAT_INTERVAL = 5 * 60 * 1000;
const VISIBILITY_CHECK_DELAY = 2000;

export function useSupabaseConnectionKeepAlive(enabled: boolean = true) {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const performHeartbeat = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (error) {
          logger.warn('KeepAlive', 'Heartbeat query failed:', error);
        } else {
          logger.log('KeepAlive', 'Heartbeat successful');
        }
      } catch (error) {
        logger.warn('KeepAlive', 'Heartbeat error:', error);
      }
    };

    const startHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      performHeartbeat();

      heartbeatIntervalRef.current = setInterval(() => {
        performHeartbeat();
      }, HEARTBEAT_INTERVAL);

      logger.log('KeepAlive', 'Heartbeat iniciado');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.log('KeepAlive', 'Usuário voltou - verificando conexão...');

        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
        }

        visibilityTimeoutRef.current = setTimeout(() => {
          performHeartbeat();
        }, VISIBILITY_CHECK_DELAY);
      }
    };

    startHeartbeat();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      logger.log('KeepAlive', 'Heartbeat finalizado');
    };
  }, [enabled]);
}
