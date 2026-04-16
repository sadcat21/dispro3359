import React, { createContext, useContext, useState } from 'react';
import { landingT, LandingLang } from '@/i18n/landingTranslations';

interface LandingLanguageContextType {
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const LandingLanguageContext = createContext<LandingLanguageContextType | null>(null);

export const useLandingLang = () => {
  const ctx = useContext(LandingLanguageContext);
  if (!ctx) throw new Error('useLandingLang must be used within LandingLanguageProvider');
  return ctx;
};

export const LandingLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<LandingLang>('fr');

  const t = (key: string): string => {
    const entry = landingT[key];
    if (!entry) return key;
    return entry[lang];
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LandingLanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LandingLanguageContext.Provider>
  );
};
