import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isInitialized, setIsInitialized] = useState(false);
  const isLoadingTheme = useRef(false);
  const themeCache = useRef<Theme | null>(null);

  useEffect(() => {
    const loadTheme = async () => {
      if (isLoadingTheme.current) {
        logger.log('ThemeContext', 'Theme already loading, skipping');
        return;
      }

      if (themeCache.current) {
        logger.log('ThemeContext', 'Using cached theme:', themeCache.current);
        setThemeState(themeCache.current);
        document.documentElement.setAttribute('data-theme', themeCache.current);
        setIsInitialized(true);
        return;
      }

      isLoadingTheme.current = true;
      logger.log('ThemeContext', 'Loading theme...');

      const localTheme = localStorage.getItem('theme') as Theme;
      if (localTheme) {
        setThemeState(localTheme);
        document.documentElement.setAttribute('data-theme', localTheme);
        themeCache.current = localTheme;
        logger.log('ThemeContext', 'Theme loaded from localStorage:', localTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeCache.current = 'dark';
        logger.log('ThemeContext', 'Using default theme: dark');
      }

      setIsInitialized(true);
      isLoadingTheme.current = false;

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (userId) {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('theme_preference')
            .eq('id', userId)
            .maybeSingle();

          if (!error && data?.theme_preference && data.theme_preference !== themeCache.current) {
            setThemeState(data.theme_preference as Theme);
            document.documentElement.setAttribute('data-theme', data.theme_preference);
            themeCache.current = data.theme_preference as Theme;
            localStorage.setItem('theme', data.theme_preference);
            logger.log('ThemeContext', 'Theme synced from database:', data.theme_preference);
          }
        } catch (err) {
          logger.error('ThemeContext', 'Error loading theme preference:', err);
        }
      }
    };

    if (!isInitialized) {
      loadTheme();
    }
  }, [isInitialized]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    themeCache.current = newTheme;
    localStorage.setItem('theme', newTheme);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (userId) {
      try {
        await supabase
          .from('user_profiles')
          .update({ theme_preference: newTheme })
          .eq('id', userId);
        logger.log('ThemeContext', 'Theme saved to database:', newTheme);
      } catch (err) {
        logger.error('ThemeContext', 'Error saving theme preference:', err);
      }
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
