import { useCallback, useEffect, useState } from "react";

export type AppLocale = "vi" | "en";

const LOCALE_STORAGE_KEY = "cloudcollab.locale";
const LOCALE_EVENT_NAME = "cloudcollab-locale-change";

function readLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "vi";
  }

  const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return raw === "en" ? "en" : "vi";
}

function writeLocale(locale: AppLocale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  window.dispatchEvent(new Event(LOCALE_EVENT_NAME));
}

export function useLocale() {
  const [locale, setLocaleState] = useState<AppLocale>(() => readLocale());

  useEffect(() => {
    const syncLocale = () => {
      setLocaleState(readLocale());
    };

    window.addEventListener(LOCALE_EVENT_NAME, syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener(LOCALE_EVENT_NAME, syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    writeLocale(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (vi: string, en: string) => (locale === "vi" ? vi : en),
    [locale],
  );

  return {
    locale,
    setLocale,
    t,
  };
}
