import { useState, useEffect, useLayoutEffect } from 'react';

const SIDEBAR_STORAGE_KEY = 'wis-sidebar-collapsed';
const MOBILE_BREAKPOINT = 1024;

interface UseResponsiveSidebarReturn {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
}

export function useResponsiveSidebar(): UseResponsiveSidebarReturn {
  const getInitialState = (): boolean => {
    if (typeof window === 'undefined') return true;

    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }

    return window.innerWidth < MOBILE_BREAKPOINT;
  };

  const [isCollapsed, setIsCollapsed] = useState(getInitialState);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useLayoutEffect(() => {
    const initialState = getInitialState();
    setIsCollapsed(initialState);

    setTimeout(() => setIsInitialLoad(false), 100);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) return;

      const shouldCollapse = window.innerWidth < MOBILE_BREAKPOINT;
      setIsCollapsed(shouldCollapse);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newState));
      return newState;
    });
  };

  const setCollapsedState = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  };

  return {
    isCollapsed: isInitialLoad ? getInitialState() : isCollapsed,
    toggleCollapsed,
    setIsCollapsed: setCollapsedState,
  };
}
