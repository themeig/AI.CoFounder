"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import en from "./locales/en.json";
import it from "./locales/it.json";

type Language = "en" | "it";

const dictionaries: Record<Language, any> = { en, it };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("agentfoundry_lang") as Language;
    if (saved && (saved === "en" || saved === "it")) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("agentfoundry_lang", lang);
  };

  const t = (key: string, fallback?: string): string => {
    const dict = dictionaries[language] || dictionaries.en;
    const parts = key.split(".");
    let val: any = dict;
    for (const part of parts) {
      if (val && typeof val === "object" && part in val) {
        val = val[part];
      } else {
        val = undefined;
        break;
      }
    }
    if (typeof val === "string") return val;
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
