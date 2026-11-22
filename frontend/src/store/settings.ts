import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type Lang = 'uk' | 'en';

interface SettingsState {
  theme: Theme;
  lang: Lang;
  setTheme: (theme: Theme) => void;
  setLang: (lang: Lang) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      lang: 'uk',
      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
    }),
    { name: 'pixelforge:settings' },
  ),
);

export function resolveDark(theme: Theme): boolean {
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return theme === 'dark';
}
