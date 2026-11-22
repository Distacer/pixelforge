import { useEffect, useState } from 'react';
import { useT } from '../../shared/i18n';
import { clamp, cn } from '../../shared/lib/misc';
import { Modal } from '../../shared/ui/Modal';
import { MAX_SIZE } from './model';

const PRESETS = [16, 24, 32, 48, 64, 128];

interface NewCanvasDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (width: number, height: number, title: string) => void;
  warnUnsaved?: boolean;
}

export function NewCanvasDialog({ open, onClose, onCreate, warnUnsaved }: NewCanvasDialogProps) {
  const t = useT();
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (open) setTitle('');
  }, [open]);

  const submit = () => {
    onCreate(clamp(width || 1, 1, MAX_SIZE), clamp(height || 1, 1, MAX_SIZE), title.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('newCanvas.title')}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="new-canvas" className="btn-primary">
            {t('newCanvas.create')}
          </button>
        </>
      }
    >
      <form
        id="new-canvas"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-5"
      >
        <div>
          <label className="label" htmlFor="nc-title">
            {t('newCanvas.name')}
          </label>
          <input
            id="nc-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('editor.untitled')}
            maxLength={80}
            data-autofocus
          />
        </div>

        <fieldset>
          <legend className="label">{t('newCanvas.size')}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PRESETS.map((size) => {
              const active = width === size && height === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setWidth(size);
                    setHeight(size);
                  }}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-px border-2 px-2 py-2.5 text-xs transition-colors',
                    active ? 'border-[rgb(var(--shadow))] bg-accent text-accent-ink shadow-pixel-sm' : 'border-line hover:border-ink/40',
                  )}
                >
                  <span
                    className="block border border-current opacity-70"
                    style={{ width: 6 + Math.log2(size) * 3, height: 6 + Math.log2(size) * 3 }}
                  />
                  {size}×{size}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="number"
              min={1}
              max={MAX_SIZE}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="input w-24"
              aria-label={t('newCanvas.width')}
            />
            <span className="text-muted">×</span>
            <input
              type="number"
              min={1}
              max={MAX_SIZE}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="input w-24"
              aria-label={t('newCanvas.height')}
            />
            <span className="text-xs text-muted">{t('newCanvas.max', { n: MAX_SIZE })}</span>
          </div>
        </fieldset>

        {warnUnsaved && (
          <p className="rounded-px border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {t('newCanvas.unsaved')}
          </p>
        )}
      </form>
    </Modal>
  );
}
