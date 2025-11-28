import { useEffect, useRef } from 'react';

export function useEffectOnce(effect: () => void | (() => void)) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      return effect();
    }
  }, []);
}
