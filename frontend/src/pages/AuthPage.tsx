import { Check, Eye, EyeOff, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { SpriteView } from '../features/home/SpriteView';
import { POTION_SPRITE } from '../features/home/sprites';
import { ApiError, api } from '../shared/api/client';
import { useDebounced } from '../shared/hooks/useDebounced';
import { useT } from '../shared/i18n';
import { cn } from '../shared/lib/misc';
import { Spinner } from '../shared/ui/controls';
import { useAuth } from '../store/auth';
import { toast } from '../store/toasts';

const USERNAME_RE = /^[\p{L}\p{N}_-]{3,24}$/u;

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

/** Жива перевірка, чи вільний нік (із затримкою, щоб не смикати сервер на кожну літеру). */
function useUsernameAvailability(username: string, enabled: boolean): Availability {
  const value = useDebounced(username.trim(), 400);
  const [state, setState] = useState<Availability>('idle');

  useEffect(() => {
    if (!enabled || !value) return setState('idle');
    if (!USERNAME_RE.test(value)) return setState('invalid');
    const controller = new AbortController();
    setState('checking');
    api.auth
      .checkUsername(value, controller.signal)
      .then((res) => setState(res.available ? 'free' : 'taken'))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setState('idle');
      });
    return () => controller.abort();
  }, [value, enabled]);

  return state;
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/me';
  const token = useAuth((s) => s.token);
  const setSession = useAuth((s) => s.setSession);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';
  const availability = useUsernameAvailability(username, isRegister);

  useEffect(() => setError(null), [mode]);

  if (token) return <Navigate to={next.startsWith('/') ? next : '/me'} replace />;

  const passwordTooShort = isRegister && password.length > 0 && password.length < 6;
  const mismatch = isRegister && confirm.length > 0 && confirm !== password;
  const canSubmit =
    username.trim().length > 0 &&
    password.length > 0 &&
    (!isRegister ||
      (availability !== 'taken' && availability !== 'invalid' && password.length >= 6 && confirm === password));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = isRegister
        ? await api.auth.register(username.trim(), password)
        : await api.auth.login(username.trim(), password);
      setSession(res.access_token, res.user);
      toast.success(isRegister ? t('auth.welcomeNew', { name: res.user.username }) : t('auth.welcome', { name: res.user.username }));
      navigate(next.startsWith('/') ? next : '/me', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError(t('auth.invalid'));
      else if (err instanceof ApiError && err.status === 409) setError(t('auth.taken'));
      else if (err instanceof ApiError && err.status !== 0) setError(err.message);
      else setError(t('error.network'));
    } finally {
      setBusy(false);
    }
  };

  const hint: Record<Availability, { text: string; tone: string } | null> = {
    idle: null,
    checking: { text: t('auth.checking'), tone: 'text-muted' },
    free: { text: t('auth.free'), tone: 'text-teal' },
    taken: { text: t('auth.taken'), tone: 'text-danger' },
    invalid: { text: t('auth.usernameRules'), tone: 'text-danger' },
  };
  const usernameHint = isRegister ? hint[availability] : null;

  return (
    <div className="mx-auto flex max-w-sm flex-col px-5 py-14">
      <SpriteView sprite={POTION_SPRITE} className="w-14" />
      <h1 className="mt-6 font-pixel text-3xl">{isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}</h1>
      <p className="mt-2 text-muted">{isRegister ? t('auth.registerText') : t('auth.loginText')}</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-5" noValidate>
        <div>
          <label className="label" htmlFor="auth-username">
            {t('auth.username')}
          </label>
          <div className="relative">
            <input
              id="auth-username"
              className="input pr-9"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={24}
              required
              autoFocus
              aria-describedby="auth-username-hint"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {availability === 'checking' && <Spinner size={14} className="text-muted" />}
              {availability === 'free' && <Check size={16} className="text-teal" />}
              {(availability === 'taken' || availability === 'invalid') && <X size={16} className="text-danger" />}
            </span>
          </div>
          <p id="auth-username-hint" className={cn('mt-1.5 text-xs', usernameHint?.tone ?? 'text-muted')}>
            {usernameHint?.text ?? (isRegister ? t('auth.usernameRules') : ' ')}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="auth-password">
            {t('auth.password')}
          </label>
          <div className="relative">
            <input
              id="auth-password"
              className="input pr-10"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              maxLength={72}
              required
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted hover:text-ink"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {isRegister && (
            <p className={cn('mt-1.5 text-xs', passwordTooShort ? 'text-danger' : 'text-muted')}>
              {t('auth.passwordRules')}
            </p>
          )}
        </div>

        {isRegister && (
          <div>
            <label className="label" htmlFor="auth-confirm">
              {t('auth.confirm')}
            </label>
            <input
              id="auth-confirm"
              className={cn('input', mismatch && 'border-danger')}
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              maxLength={72}
              required
            />
            {mismatch && <p className="mt-1.5 text-xs text-danger">{t('auth.mismatch')}</p>}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-px border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary py-2.5" disabled={!canSubmit || busy}>
          {busy && <Spinner size={16} />}
          {isRegister ? t('auth.register') : t('auth.login')}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
        <Link
          to={`${isRegister ? '/login' : '/register'}${params.toString() ? `?${params}` : ''}`}
          className="font-medium text-ink underline underline-offset-4"
        >
          {isRegister ? t('auth.login') : t('auth.register')}
        </Link>
      </p>
    </div>
  );
}
