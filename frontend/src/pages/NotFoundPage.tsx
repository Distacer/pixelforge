import { Link } from 'react-router-dom';
import { useT } from '../shared/i18n';
import { SpriteView } from '../features/home/SpriteView';
import { GHOST_SPRITE } from '../features/home/sprites';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <SpriteView sprite={GHOST_SPRITE} className="w-28" label="404" />
      <h1 className="mt-8 font-pixel text-4xl">404</h1>
      <p className="mt-3 text-muted">{t('notFound.text')}</p>
      <div className="mt-8 flex gap-2">
        <Link to="/" className="btn-secondary">
          {t('notFound.home')}
        </Link>
        <Link to="/gallery" className="btn-primary">
          {t('nav.gallery')}
        </Link>
      </div>
    </div>
  );
}
