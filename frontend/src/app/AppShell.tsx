import { Images, LayoutGrid, LogIn, LogOut, Menu as MenuIcon, Monitor, Moon, PenTool, Sun, User } from 'lucide-react';
import { Suspense } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate, useRouteError } from 'react-router-dom';
import { useT } from '../shared/i18n';
import { cn } from '../shared/lib/misc';
import { Spinner } from '../shared/ui/controls';
import { Menu } from '../shared/ui/Menu';
import { useAuth } from '../store/auth';
import { type Theme, useSettings } from '../store/settings';
import { toast } from '../store/toasts';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)} aria-label="Pixelforge">
      <span className="grid h-6 w-6 grid-cols-2 gap-[2px] rounded-[2px] bg-[rgb(var(--shadow))] p-[3px] transition-transform group-hover:rotate-90">
        <span className="bg-accent" />
        <span className="bg-teal" />
        <span className="bg-teal" />
        <span className="bg-white" />
      </span>
      <span className="font-pixel text-lg leading-none tracking-tight">Pixelforge</span>
    </Link>
  );
}

const THEME_ORDER: Theme[] = ['system', 'light', 'dark'];
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };

function HeaderControls() {
  const t = useT();
  const navigate = useNavigate();
  const { theme, setTheme, lang, setLang } = useSettings();
  const { user, logout } = useAuth();
  const ThemeIcon = THEME_ICON[theme];
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="icon-btn w-auto px-2 text-xs font-semibold"
        onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
        aria-label={t('header.language')}
        title={t('header.language')}
      >
        {lang === 'uk' ? 'UA' : 'EN'}
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setTheme(nextTheme)}
        aria-label={`${t('header.theme')}: ${t(`theme.${theme}`)}`}
        title={`${t('header.theme')}: ${t(`theme.${theme}`)}`}
      >
        <ThemeIcon size={18} />
      </button>

      {user ? (
        <Menu
          trigger={(props) => (
            <button type="button" className="btn-ghost ml-1 px-2.5 py-1.5" {...props}>
              <span className="grid h-6 w-6 place-items-center rounded-[2px] bg-teal font-pixel text-xs text-white">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate sm:inline">{user.username}</span>
            </button>
          )}
          items={[
            { label: t('nav.myWorks'), icon: Images, onSelect: () => navigate('/me') },
            { label: t('nav.profile'), icon: User, onSelect: () => navigate(`/u/${encodeURIComponent(user.username)}`) },
            'divider',
            {
              label: t('auth.logout'),
              icon: LogOut,
              onSelect: () => {
                logout();
                toast.info(t('auth.loggedOut'));
                navigate('/');
              },
            },
          ]}
        />
      ) : (
        <Link to="/login" className="btn-secondary ml-1 px-3 py-1.5">
          <LogIn size={16} />
          <span className="hidden sm:inline">{t('auth.login')}</span>
        </Link>
      )}
    </div>
  );
}

function Header({ compact }: { compact: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const links = [
    { to: '/editor', label: t('nav.editor'), icon: PenTool },
    { to: '/gallery', label: t('nav.gallery'), icon: LayoutGrid },
    { to: '/me', label: t('nav.myWorks'), icon: Images },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur',
        compact ? 'h-12' : 'h-14',
      )}
    >
      <div className={cn('mx-auto flex h-full items-center gap-6 px-3 sm:px-5', !compact && 'max-w-6xl')}>
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label={t('nav.main')}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-px px-3 py-1.5 text-sm transition-colors',
                  isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:text-ink',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Menu
            className="md:hidden"
            trigger={(props) => (
              <button type="button" className="icon-btn" aria-label={t('nav.main')} {...props}>
                <MenuIcon size={18} />
              </button>
            )}
            items={links.map((link) => ({ label: link.label, icon: link.icon, onSelect: () => navigate(link.to) }))}
          />
          <HeaderControls />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="font-pixel text-ink">Pixelforge</span>
        <span>{t('footer.note')}</span>
      </div>
    </footer>
  );
}

function PageFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-muted">
      <Spinner size={28} />
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/editor');

  return (
    <div className={cn('flex flex-col', isEditor ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <Header compact={isEditor} />
      <main className={cn('flex-1', isEditor && 'min-h-0')}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      {!isEditor && <Footer />}
      <ScrollRestoration />
    </div>
  );
}

export function RouteError() {
  const error = useRouteError() as Error | undefined;
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="font-pixel text-2xl">Oops</h1>
      <p className="mt-3 text-muted">{error?.message ?? 'Unexpected error'}</p>
      <a href="/" className="btn-primary mt-8">
        Pixelforge
      </a>
    </div>
  );
}
