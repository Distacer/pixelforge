import { useEffect, useState } from 'react';
import { API_BASE, api } from '../../shared/api/client';
import type { Artwork } from '../../shared/api/types';

/**
 * URL прев'ю роботи. Публічні віддаються напряму (кешуються браузером),
 * приватні вимагають JWT, а <img> не вміє слати заголовки — тож тягнемо blob через fetch.
 */
export function useArtworkImage(artwork: Pick<Artwork, 'preview_url' | 'is_public'>): string | null {
  const direct = artwork.is_public ? `${API_BASE}${artwork.preview_url}` : null;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (direct) return;
    let url: string | null = null;
    let cancelled = false;
    api.artworks
      .previewBlob(artwork)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => setBlobUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direct, artwork.preview_url]);

  return direct ?? blobUrl;
}
