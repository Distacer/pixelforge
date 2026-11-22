import { Heart, Images } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArtworkCard, ArtworkGrid, ArtworkGridSkeleton } from '../features/gallery/ArtworkCard';
import { ArtworkViewer } from '../features/gallery/ArtworkViewer';
import { ListError, ListFooter } from '../features/gallery/ListStates';
import { useArtworkList } from '../features/gallery/useArtworkList';
import { ApiError, api } from '../shared/api/client';
import type { Artwork, PublicProfile } from '../shared/api/types';
import { useT } from '../shared/i18n';
import { formatDate } from '../shared/lib/misc';
import { EmptyState } from '../shared/ui/controls';
import { useSettings } from '../store/settings';
import { NotFoundPage } from './NotFoundPage';

export function ProfilePage() {
  const t = useT();
  const { username = '' } = useParams();
  const lang = useSettings((s) => s.lang);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [viewing, setViewing] = useState<Artwork | null>(null);

  useEffect(() => {
    setProfile(null);
    setMissing(false);
    api.users
      .profile(username)
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
      });
  }, [username]);

  const fetchPage = useCallback(
    (offset: number, limit: number) => api.users.artworks(username, { offset, limit }),
    [username],
  );
  const list = useArtworkList(fetchPage);

  const update = (artwork: Artwork) => {
    list.update(artwork);
    if (viewing?.id === artwork.id) setViewing(artwork);
  };

  if (missing) return <NotFoundPage />;

  return (
    <div className="mx-auto max-w-6xl px-5 pt-10">
      <header className="flex items-center gap-5">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-px border-2 border-[rgb(var(--shadow))] bg-teal font-pixel text-2xl text-white shadow-pixel">
          {(profile?.username ?? username).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-pixel text-2xl sm:text-3xl">{profile?.username ?? username}</h1>
          {profile && (
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Images size={14} />
                {t('profile.works', { n: profile.public_artworks })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Heart size={14} />
                {t('profile.likes', { n: profile.total_likes })}
              </span>
              <span>{t('profile.since', { date: formatDate(profile.created_at, lang) })}</span>
            </p>
          )}
        </div>
      </header>

      <div className="mt-10">
        {list.error && list.items.length === 0 ? (
          <ListError onRetry={list.reload} />
        ) : list.loading && list.items.length === 0 ? (
          <ArtworkGridSkeleton />
        ) : list.items.length === 0 ? (
          <EmptyState title={t('profile.empty')} />
        ) : (
          <>
            <ArtworkGrid>
              {list.items.map((artwork) => (
                <ArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  onOpen={setViewing}
                  onChange={update}
                  showOwner={false}
                />
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
