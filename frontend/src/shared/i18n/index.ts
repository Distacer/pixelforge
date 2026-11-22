import { useCallback } from 'react';
import { type Lang, useSettings } from '../../store/settings';
import { en } from './en';
import { uk } from './uk';

export type TKey = keyof typeof uk;
export type TVars = Record<string, string | number>;
export type TFunction = (key: TKey, vars?: TVars) => string;

const dictionaries: Record<Lang, Record<TKey, string>> = { uk, en };

export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  let text = dictionaries[lang][key] ?? uk[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** Хук перекладу: const t = useT(); t('nav.gallery') */
export function useT(): TFunction {
  const lang = useSettings((s) => s.lang);
  return useCallback((key: TKey, vars?: TVars) => translate(lang, key, vars), [lang]);
}

/** Переклад поза компонентами (у сторах, обробниках помилок). */
export function t(key: TKey, vars?: TVars): string {
  return translate(useSettings.getState().lang, key, vars);
}
