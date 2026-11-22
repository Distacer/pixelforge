import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { startDraftAutosave } from '../features/editor/store';
import { api } from '../shared/api/client';
import { Toaster } from '../shared/ui/Toaster';
import { useAuth } from '../store/auth';
import { resolveDark, useSettings } from '../store/settings';
import { router } from './router';

function useThemeSync() {
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);

  useEffect(() => {
    const apply = () => {
      const dark = resolveDark(theme);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1B1A2E' : '#EEEDF5');
    };
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}

/** Якщо в localStorage є токен — перевіряємо, що він досі дійсний. */
function useSessionCheck() {
  useEffect(() => {
    const { token, setUser } = useAuth.getState();
    if (!token) return;
    api.users
      .me()
      .then(setUser)
      .catch(() => {
        /* 401 → client.ts сам виконає logout; мережеві помилки ігноруємо */
      });
  }, []);
}

export function App() {
  useThemeSync();
  useSessionCheck();
  useEffect(() => startDraftAutosave(), []);

  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
      <Toaster />
    </MotionConfig>
  );
}
