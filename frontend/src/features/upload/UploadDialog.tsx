/**
 * Завантаження PNG двома способами:
 *  1) «У редактор» — картинка пікселізується до сітки 16…128 і стає редагованим документом;
 *  2) «У галерею» — файл зберігається на сервері як є (тип "image").
 */

import { ImageUp, PenTool, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import type { Artwork } from '../../shared/api/types';
import { useT } from '../../shared/i18n';
import { fitSize, isPngFile, pixelate } from '../../shared/lib/image';
import { cn } from '../../shared/lib/misc';
import { Segmented, Spinner, Switch } from '../../shared/ui/controls';
import { Modal } from '../../shared/ui/Modal';
import { PixelImage } from '../../shared/ui/PixelImage';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toasts';
import { compositeFrame, docFromPixels } from '../editor/model';
import { useEditor } from '../editor/store';

export type UploadMode = 'editor' | 'gallery';

const MAX_UPLOAD = 2 * 1024 * 1024;
const MAX_IMPORT = 10 * 1024 * 1024;
const SIDES = [16, 32, 64, 128];

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: UploadMode;
  /** Файл, який треба одразу підставити (наприклад, при імпорті вже завантаженої картинки) */
  initialFile?: File | null;
  onUploaded?: (artwork: Artwork) => void;
}

interface Picked {
  file: File;
  url: string;
  bitmap: ImageBitmap;
}

export function UploadDialog({
  open,
  onClose,
  defaultMode = 'editor',
  initialFile,
  onUploaded,
}: UploadDialogProps) {
  const t = useT();
  const navigate = useNavigate();
  const token = useAuth((s) => s.token);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>(defaultMode);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [side, setSide] = useState(32);
  const [smooth, setSmooth] = useState(true);
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  // Скидаємо стан при кожному відкритті
  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
    setPicked(null);
    setError(null);
    setTitle('');
    setIsPublic(false);
    if (initialFile) void accept(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultMode, initialFile]);

  useEffect(() => {
    if (!picked) return;
    return () => {
      URL.revokeObjectURL(picked.url);
      picked.bitmap.close();
    };
  }, [picked]);

  const accept = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!(await isPngFile(file))) {
      setError(t('upload.notPng'));
      return;
    }
    if (file.size > MAX_IMPORT) {
      setError(t('upload.tooBig', { mb: MAX_IMPORT / 1024 / 1024 }));
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      setPicked({ file, url: URL.createObjectURL(file), bitmap });
      setTitle(file.name.replace(/\.png$/i, '').slice(0, 80));
      // Якщо PNG маленький — пропонуємо його рідний розмір
      const longest = Math.max(bitmap.width, bitmap.height);
      setSide(SIDES.find((s) => s >= longest) ?? 64);
      setSmooth(longest > 128);
    } catch {
      setError(t('upload.notPng'));
    }
  };

  const target = picked ? fitSize(picked.bitmap.width, picked.bitmap.height, side) : null;
  const preview = useMemo(() => {
    if (!picked || !target) return null;
    const pixels = pixelate(picked.bitmap, target.width, target.height, smooth);
    const doc = docFromPixels(target.width, target.height, pixels, t('layers.defaultName', { n: 1 }));
    return { doc, rgba: compositeFrame(doc, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, target?.width, target?.height, smooth, t]);

  const openInEditor = () => {
    if (!preview) return;
    useEditor.getState().loadDocument({
      doc: preview.doc,
      meta: { id: null, title: title.trim(), isPublic: false, dirty: true },
    });
    onClose();
    navigate('/editor');
    toast.success(t('upload.imported'));
  };

  const uploadToGallery = async () => {
    if (!picked) return;
    if (picked.file.size > MAX_UPLOAD) {
      setError(t('upload.tooBig', { mb: MAX_UPLOAD / 1024 / 1024 }));
      return;
    }
    setBusy(true);
    try {
      const artwork = await api.artworks.upload(picked.file, title.trim() || t('editor.untitled'), isPublic);
      toast.success(t('upload.uploaded'));
      onUploaded?.(artwork);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? e.message : t('error.network'));
    } finally {
      setBusy(false);
    }
  };

  const draftDirty = useEditor((s) => s.meta.dirty);
  const tooBigForGallery = !!picked && picked.file.size > MAX_UPLOAD;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('upload.title')}
      size="lg"
      footer={
        picked && (
          <>
            <button type="button" className="btn-ghost" onClick={() => setPicked(null)}>
              {t('upload.another')}
            </button>
            {mode === 'editor' ? (
              <button type="button" className="btn-primary" onClick={openInEditor}>
                <PenTool size={16} />
                {t('upload.openInEditor')}
              </button>
            ) : token ? (
              <button
                type="button"
                className="btn-primary"
                onClick={uploadToGallery}
                disabled={busy || tooBigForGallery}
              >
                {busy ? <Spinner size={16} /> : <Upload size={16} />}
                {t('upload.save')}
              </button>
            ) : (
              <Link to="/login?next=/me" className="btn-primary" onClick={onClose}>
                {t('upload.loginToSave')}
              </Link>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <Segmented<UploadMode>
          label={t('upload.mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'editor', label: t('upload.modeEditor') },
            { value: 'gallery', label: t('upload.modeGallery') },
          ]}
        />
        <p className="-mt-2 text-sm text-muted">
          {mode === 'editor' ? t('upload.modeEditorHint') : t('upload.modeGalleryHint')}
        </p>

        {!picked ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void accept(e.dataTransfer.files[0]);
            }}
            className={cn(
              'flex flex-col items-center gap-3 rounded-px border-2 border-dashed px-6 py-12 text-center transition-colors',
              dragging ? 'border-accent bg-accent/10' : 'border-line hover:border-ink/40',
            )}
          >
            <ImageUp size={32} className="text-muted" />
            <span className="font-medium">{t('upload.drop')}</span>
            <span className="text-sm text-muted">{t('upload.limits', { mb: MAX_UPLOAD / 1024 / 1024 })}</span>
          </button>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <figure className="flex flex-col gap-2">
              <div className="checker grid aspect-square place-items-center overflow-hidden rounded-px border border-line">
                {mode === 'editor' && preview ? (
                  <PixelImage
                    rgba={preview.rgba}
                    width={preview.doc.width}
                    height={preview.doc.height}
                    className="max-h-full max-w-full"
                    label={t('upload.preview')}
                  />
                ) : (
                  <img src={picked.url} alt={t('upload.preview')} className="max-h-full max-w-full object-contain" />
                )}
              </div>
              <figcaption className="text-xs tabular-nums text-muted">
                {picked.bitmap.width}×{picked.bitmap.height}px
                {mode === 'editor' && target && ` → ${target.width}×${target.height}`},{' '}
                {(picked.file.size / 1024).toFixed(0)} KB
              </figcaption>
            </figure>

            <div className="flex flex-col gap-4">
              <div>
                <label className="label" htmlFor="upload-title">
                  {t('upload.name')}
                </label>
                <input
                  id="upload-title"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                />
              </div>

              {mode === 'editor' ? (
                <>
                  <div>
                    <div className="label">{t('upload.gridSize')}</div>
                    <Segmented<number>
                      label={t('upload.gridSize')}
                      value={side}
                      onChange={setSide}
                      options={SIDES.map((s) => ({ value: s, label: String(s) }))}
                    />
                  </div>
                  <Switch
                    checked={smooth}
                    onChange={setSmooth}
                    label={t('upload.smooth')}
                    description={t('upload.smoothHint')}
                  />
                  {draftDirty && <p className="text-sm text-danger">{t('newCanvas.unsaved')}</p>}
                </>
              ) : (
                <>
                  <Switch
                    checked={isPublic}
                    onChange={setIsPublic}
                    label={t('artwork.public')}
                    description={t('artwork.publicHint')}
                  />
                  {tooBigForGallery && (
                    <p className="text-sm text-danger">{t('upload.tooBig', { mb: MAX_UPLOAD / 1024 / 1024 })}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-px border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => {
            void accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </Modal>
  );
}
