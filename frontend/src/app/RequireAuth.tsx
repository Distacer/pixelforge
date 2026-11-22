import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

/** Пускає на сторінку лише залогінених; інших відправляє на /login?next=... */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const location = useLocation();
  if (!token) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
