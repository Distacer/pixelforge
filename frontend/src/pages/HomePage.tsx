import { Download, Film, ImageUp, Keyboard, Layers, PaintBucket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArtworkThumb } from '../features/gallery/ArtworkCard';
import { HeroCanvas } from '../features/home/HeroCanvas';
import { api } from '../shared/api/client';
import type { Artwork } from '../shared/api/types';
import { type TKey, useT } from '../shared/i18n';

const FEATURES: Array<{ icon: typeof Layers; title: TKey; text: TKey }> = [
  { icon: PaintBucket, title: 'home.f1Title', text: 'home.f1Text' },
  { icon: Layers, title: 'home.f2Title', text: 'home.f2Text' },
  { icon: Film, title: 'home.f3Title', text: 'home.f3Text' },
  { icon: Download, title: 'home.f4Title', text: 'home.f4Text' },
  { icon: ImageUp, title: 'home.f5Title', text: 'home.f5Text' },
  { icon: Keyboard, title: 'home.f6Title', text: 'home.f6Text' },
];

function FreshWorks() {
  const t = useT();
  const [items, setItems] = useState<Artwork[]>([]);

  useEffect(() => {
    api.gallery
      .list({ sort: 'new', limit: 6 })
      .then((page) => setItems(page.items))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mt-24" aria-labelledby="fresh-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="fresh-title" className="font-pixel text-2xl">
          {t('home.freshTitle')}
        </h2>
        <Link to="/gallery" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {t('home.freshAll')}
        </Link>
      </div>
      <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {items.map((artwork) => (
          <li key={artwork.id}>
            <Link
              to={`/u/${encodeURIComponent(artwork.owner)}`}
              className="block overflow-hidden rounded-px border-2 border-line hover:border-[rgb(var(--shadow))]"
              title={`${artwork.title} — ${artwork.owner}`}
            >
              <ArtworkThumb artwork={artwork} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomePage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="grid items-center gap-12 pb-8 pt-12 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <h1 className="font-pixel text-5xl leading-none tracking-tight sm:text-6xl xl:text-7xl">
            {t('home.heroLine1')}
            <br />
            {t('home.heroLine2')}
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">{t('home.heroText')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/editor" className="btn-primary px-5 py-2.5 text-base">
              {t('home.ctaEditor')}
            </Link>
            <Link to="/gallery" className="btn-secondary px-5 py-2.5 text-base">
              {t('home.ctaGallery')}
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">{t('home.ctaNote')}</p>
        </div>
        <HeroCanvas />
      </section>

      <section className="mt-20" aria-labelledby="features-title">
        <h2 id="features-title" className="font-pixel text-2xl">
          {t('home.featuresTitle')}
        </h2>
        <ul className="mt-8 grid gap-x-12 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-4 border-t border-line py-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[2px] bg-surface-2 text-teal">
                <feature.icon size={18} />
              </span>
              <div>
                <h3 className="font-semibold">{t(feature.title)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(feature.text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <FreshWorks />
    </div>
  );
}
