import { Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArtworkCard, ArtworkGrid, ArtworkGridSkeleton } from '../features/gallery/ArtworkCard';
import { ArtworkViewer } from '../features/gallery/ArtworkViewer';
import { ListError, ListFooter } from '../features/gallery/ListStates';
import { useArtworkList } from '../features/gallery/useArtworkList';
import { api } from '../shared/api/client';
import type { Artwork, SortMode } from '../shared/api/types';
import { useDebounced } from '../shared/hooks/useDebounced';
import { useT } from '../shared/i18n';
import { EmptyState, Segmented } from '../shared/ui/controls';

export function GalleryPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const sort = (params.get('sort') === 'popular' ? 'popular' : 'new') as SortMode;
  const [query, setQuery] = useState(params.get('q') ?? '');
  const q = useDebounced(query.trim());
  const [viewing, setViewing] = useState<Artwork | null>(null);

  const fetchPage = useCallback(
    (offset: number, limit: number) => api.gallery.list({ sort, q, offset, limit }),
    [sort, q],
  );
  const list = useArtworkList(fetchPage);

  const update = (artwork: Artwork) => {
    list.update(artwork);
    if (viewing?.id === artwork.id) setViewing(artwork);
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pt-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-pixel text-3xl sm:text-4xl">{t('gallery.title')}</h1>
          <p className="mt-2 max-w-md text-muted">{t('gallery.subtitle')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setParam('q', e.target.value.trim());
              }}
              placeholder={t('gallery.search')}
              className="input pl-9 sm:w-56"
              aria-label={t('gallery.search')}
            />
          </label>
          <Segmented<SortMode>
            label={t('gallery.sort')}
            value={sort}
            onChange={(value) => setParam('sort', value === 'new' ? '' : value)}
            options={[
              { value: 'new', label: t('gallery.sortNew') },
              { value: 'popular', label: t('gallery.sortPopular') },
            ]}
          />
        </div>
      </header>

      <div className="mt-10">
        {list.error && list.items.length === 0 ? (
          <ListError onRetry={list.reload} />
        ) : list.loading && list.items.length === 0 ? (
          <ArtworkGridSkeleton />
        ) : list.items.length === 0 ? (
          <EmptyState
            title={q ? t('gallery.nothingFound') : t('gallery.empty')}
            description={q ? t('gallery.nothingFoundHint') : t('gallery.emptyHint')}
            action={
              <Link to="/editor" className="btn-primary">
                {t('home.ctaEditor')}
              </Link>
            }
          />
        ) : (
          <>
            <ArtworkGrid>
              {list.items.map((artwork) => (
                <ArtworkCard key={artwork.id} artwork={artwork} onOpen={setViewing} onChange={update} />
              ))}
            </ArtworkGrid>
            <ListFooter loading={list.loading} hasMore={list.hasMore} onMore={list.loadMore} />
          </>
        )}
      </div>

      <ArtworkViewer artwork={viewing} onClose={() => setViewing(null)} onChange={update} />
    </div>
  );
}
