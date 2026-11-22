import { motion } from 'framer-motion';
import { Ellipsis, Film, Heart, ImageIcon, Lock } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Artwork } from '../../shared/api/types';
import { useT } from '../../shared/i18n';
import { cn } from '../../shared/lib/misc';
import { Menu, type MenuItem } from '../../shared/ui/Menu';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toasts';
import { useArtworkImage } from './useArtworkImage';

export function ArtworkThumb({ artwork, className }: { artwork: Artwork; className?: string }) {
  const src = useArtworkImage(artwork);
  return (
    <div className={cn('checker grid aspect-square place-items-center overflow-hidden', className)}>
      {src ? (
        <img
          src={src}
          alt={artwork.title}
          loading="lazy"
          className="pixelated h-full w-full object-contain p-[6%]"
          draggable={false}
        />
      ) : (
        <span className="h-1/3 w-1/3 animate-pulse rounded-px bg-line/60" />
      )}
    </div>
  );
}

export function LikeButton({
  artwork,
  onChange,
  size = 'sm',
}: {
  artwork: Artwork;
  onChange: (next: Pick<Artwork, 'like_count' | 'liked_by_me'>) => void;
  size?: 'sm' | 'md';
}) {
  const t = useT();
  const navigate = useNavigate();
  const token = useAuth((s) => s.token);
  const [busy, setBusy] = useState(false);
  const liked = artwork.liked_by_me;

  const toggle = async () => {
    if (!token) {
      toast.info(t('gallery.loginToLike'));
      navigate('/login?next=/gallery');
      return;
    }
    if (busy) return;
    setBusy(true);
    // Оптимістичне оновлення: показуємо результат одразу, відкочуємо при помилці
    const previous = { like_count: artwork.like_count, liked_by_me: liked };
    onChange({ like_count: artwork.like_count + (liked ? -1 : 1), liked_by_me: !liked });
    try {
      onChange(await (liked ? api.artworks.unlike(artwork.id) : api.artworks.like(artwork.id)));
    } catch {
      onChange(previous);
      toast.error(t('error.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? t('gallery.unlike') : t('gallery.like')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-px tabular-nums transition-colors',
        size === 'sm' ? 'px-1.5 py-1 text-xs' : 'border-2 border-line px-3 py-1.5 text-sm',
        liked ? 'text-danger' : 'text-muted hover:text-ink',
      )}
    >
      <motion.span
        key={String(liked)}
        initial={{ scale: liked ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 15 }}
        className="inline-flex"
      >
        <Heart size={size === 'sm' ? 14 : 16} fill={liked ? 'currentColor' : 'none'} />
      </motion.span>
      {artwork.like_count}
    </button>
  );
}

interface ArtworkCardProps {
  artwork: Artwork;
  onOpen: (artwork: Artwork) => void;
  onChange: (artwork: Artwork) => void;
  showOwner?: boolean;
  showPrivacy?: boolean;
  menu?: Array<MenuItem | 'divider'>;
}

export function ArtworkCard({ artwork, onOpen, onChange, showOwner = true, showPrivacy, menu }: ArtworkCardProps) {
  const t = useT();
  return (
    <article className="group flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(artwork)}
        className="relative block overflow-hidden rounded-px border-2 border-line transition-colors hover:border-[rgb(var(--shadow))] focus-visible:border-accent"
        aria-label={artwork.title}
      >
        <ArtworkThumb artwork={artwork} />
        <span className="absolute left-1.5 top-1.5 flex gap-1">
          {artwork.frame_count > 1 && (
            <span className="inline-flex items-center gap-1 rounded-[2px] bg-[rgb(var(--shadow)/0.8)] px-1.5 py-0.5 text-[11px] text-white">
              <Film size={11} />
              {artwork.frame_count}
            </span>
          )}
          {artwork.kind === 'image' && (
            <span className="inline-flex items-center gap-1 rounded-[2px] bg-[rgb(var(--shadow)/0.8)] px-1.5 py-0.5 text-[11px] text-white">
              <ImageIcon size={11} />
              PNG
            </span>
          )}
          {showPrivacy && !artwork.is_public && (
            <span
              className="inline-flex items-center rounded-[2px] bg-[rgb(var(--shadow)/0.8)] px-1 py-0.5 text-white"
              title={t('artwork.private')}
            >
              <Lock size={11} />
              <span className="sr-only">{t('artwork.private')}</span>
            </span>
          )}
        </span>
      </button>

      <div className="mt-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium" title={artwork.title}>
            {artwork.title}
          </h3>
          {showOwner && (
            <Link
              to={`/u/${encodeURIComponent(artwork.owner)}`}
              className="block truncate text-xs text-muted hover:text-ink"
            >
              {artwork.owner}
            </Link>
          )}
        </div>
        {artwork.is_public && <LikeButton artwork={artwork} onChange={(next) => onChange({ ...artwork, ...next })} />}
        {menu && (
          <Menu
            trigger={(props) => (
              <button type="button" className="icon-btn h-7 w-7" aria-label={t('common.more')} {...props}>
                <Ellipsis size={16} />
              </button>
            )}
            items={menu}
          />
        )}
      </div>
    </article>
  );
}

export function ArtworkGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export function ArtworkGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ArtworkGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="aspect-square animate-pulse rounded-px bg-surface-2" />
          <div className="h-3.5 w-2/3 animate-pulse rounded-px bg-surface-2" />
        </div>
      ))}
    </ArtworkGrid>
  );
}
