import React, { createContext, useContext, useEffect, useState } from 'react';

export type UITheme = 'classic' | 'soft';
const KEY = 'ui_theme_variant';

interface Ctx {
  uiTheme: UITheme;
  toggleUITheme: () => void;
  setUITheme: (t: UITheme) => void;
}

const UIThemeContext = createContext<Ctx | null>(null);

export const useUITheme = () => {
  const ctx = useContext(UIThemeContext);
  if (!ctx) throw new Error('useUITheme must be used within UIThemeProvider');
  return ctx;
};

const apply = (t: UITheme) => {
  const root = document.documentElement;
  root.classList.toggle('theme-soft', t === 'soft');
};

export const UIThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uiTheme, setState] = useState<UITheme>('classic');

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as UITheme | null);
    const initial: UITheme = stored === 'soft' ? 'soft' : 'classic';
    setState(initial);
    apply(initial);
  }, []);

  const setUITheme = (t: UITheme) => {
    setState(t);
    localStorage.setItem(KEY, t);
    apply(t);
  };

  const toggleUITheme = () => setUITheme(uiTheme === 'soft' ? 'classic' : 'soft');

  return (
    <UIThemeContext.Provider value={{ uiTheme, toggleUITheme, setUITheme }}>
      {children}
    </UIThemeContext.Provider>
  );
};
