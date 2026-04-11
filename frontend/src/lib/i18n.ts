export type Locale = 'ru' | 'en';

export const LOCALE_STORAGE_KEY = 'mmorpg.locale.v1';

export function getDefaultLocale(): Locale {
  return 'ru';
}

export function loadStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return getDefaultLocale();
  }

  const storedValue = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return storedValue === 'en' ? 'en' : 'ru';
}

export function persistLocale(locale: Locale) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function pickLocale<T>(locale: Locale, values: { ru: T; en: T }) {
  return values[locale];
}
