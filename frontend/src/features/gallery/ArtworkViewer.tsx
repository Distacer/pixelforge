import { Download, GitFork, PenTool } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Artwork } from '../../shared/api/types';
import { useT } from '../../shared/i18n';
import { downloadBlob, formatDate, safeFilename } from '../../shared/lib/misc';
import { Spinner } from '../../shared/ui/controls';
import { Modal } from '../../shared/ui/Modal';
import { PixelImage } from '../../shared/ui/PixelImage';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toasts';
import { exportFramePng, exportGif } from '../editor/exporters';
import { compositeFrame, deserializeDoc, type PixelDoc } from '../editor/model';
import { ArtworkThumb, LikeButton } from './ArtworkCard';

/** Програє кадри документа по колу. */
function AnimatedPreview({ doc }: { doc: PixelDoc }) {
  const frames = useMemo(() => doc.frames.map((_, i) => compositeFrame(doc, i)), [doc]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), 1000 / doc.fps);
    return () => clearInterval(timer);
  }, [frames.length, doc.fps]);
  return (
    <PixelImage
      rgba={frames[index] ?? frames[0]}
      width={doc.width}
      height={doc.height}
      className="h-full w-full object-contain p-[6%]"
    />
  );
}

interface ArtworkViewerProps {
  artwork: Artwork | null;
  onClose: () => void;
  onChange: (artwork: Artwork) => void;
}

export function ArtworkViewer({ artwork, onClose, onChange }: ArtworkViewerProps) {
  const t = useT();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const user = useAuth((s) => s.user);
  const [doc, setDoc] = useState<PixelDoc | null>(null);
  const [loading, setLoading] = useState(false);

  // Для піксель-арту з кількома кадрами вантажимо документ, щоб показати анімацію
  useEffect(() => {
    setDoc(null);
    if (!artwork || artwork.kind !== 'pixel') return;
    let cancelled = false;
    setLoading(true);
    api.artworks
      .get(artwork.id)
      .then((detail) => {
        if (!cancelled) setDoc(deserializeDoc(detail.data).doc);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [artwork]);

  if (!artwork) return null;

  const mine = user?.username === artwork.owner;
  const name = safeFilename(artwork.title);

  const download = async () => {
    try {
      if (doc && doc.frames.length > 1) downloadBlob(exportGif(doc, Math.max(1, Math.floor(512 / doc.width))), `${name}.gif`);
      else if (doc) downloadBlob(await exportFramePng(doc, 0, Math.max(1, Math.floor(1024 / doc.width))), `${name}.png`);
      else downloadBlob(await api.artworks.previewBlob(artwork), `${name}.png`);
    } catch {
      toast.error(t('error.network'));
    }
  };

  return (
    <Modal open onClose={onClose} title={artwork.title} size="lg">
      <div className="grid gap-6 sm:grid-cols-[1fr_14rem]">
        <div className="checker relative aspect-square overflow-hidden rounded-px border border-line">
          {doc ? (
            <div className="checker h-full w-full">
              <AnimatedPreview doc={doc} />
            </div>
          ) : (
            <ArtworkThumb artwork={artwork} className="h-full" />
          )}
          {loading && (
            <span className="absolute right-2 top-2 text-muted">
              <Spinner size={16} />
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted">{t('artwork.author')}</dt>
            <dd>
              <Link to={`/u/${encodeURIComponent(artwork.owner)}`} onClick={onClose} className="font-medium hover:underline">
                {artwork.owner}
              </Link>
            </dd>
            <dt className="text-muted">{t('artwork.size')}</dt>
            <dd className="tabular-nums">
              {artwork.width}×{artwork.height}
            </dd>
            {artwork.frame_count > 1 && (
              <>
                <dt className="text-muted">{t('artwork.frames')}</dt>
                <dd className="tabular-nums">{artwork.frame_count}</dd>
              </>
            )}
            <dt className="text-muted">{t('artwork.created')}</dt>
            <dd>{formatDate(artwork.created_at, lang)}</dd>
          </dl>

          {artwork.is_public && (
            <div>
              <LikeButton artwork={artwork} onChange={(next) => onChange({ ...artwork, ...next })} size="md" />
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2">
            {artwork.kind === 'pixel' && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onClose();
                  navigate(`/editor/${artwork.id}`);
                }}
              >
                {mine ? <PenTool size={16} /> : <GitFork size={16} />}
                {mine ? t('artwork.edit') : t('artwork.remix')}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={download}>
              <Download size={16} />
              {doc && doc.frames.length > 1 ? t('artwork.downloadGif') : t('artwork.downloadPng')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
