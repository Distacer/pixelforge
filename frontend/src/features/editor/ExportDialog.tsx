import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../shared/i18n';
import { downloadBlob, safeFilename } from '../../shared/lib/misc';
import { Segmented } from '../../shared/ui/controls';
import { Modal } from '../../shared/ui/Modal';
import { toast } from '../../store/toasts';
import { type ExportKind, exportFramePng, exportGif, exportSpritesheet, maxScale } from './exporters';
import { useEditor } from './store';

const SCALES = [1, 2, 4, 8, 16, 32];

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const doc = useEditor((s) => s.doc);
  const frameIndex = useEditor((s) => s.frameIndex);
  const title = useEditor((s) => s.meta.title);
  const [kind, setKind] = useState<ExportKind>('png');
  const [scale, setScale] = useState(8);
  const [busy, setBusy] = useState(false);

  const animated = doc.frames.length > 1;
  const limit = maxScale(doc, kind);
  const scales = useMemo(() => SCALES.filter((s) => s <= limit), [limit]);
  useEffect(() => {
    if (scale > limit) setScale(scales[scales.length - 1] ?? 1);
  }, [limit, scale, scales]);

  const outW = (kind === 'sheet' ? doc.width * doc.frames.length : doc.width) * scale;
  const outH = doc.height * scale;

  const run = async () => {
    setBusy(true);
    try {
      const name = safeFilename(title || t('editor.untitled'));
      if (kind === 'png') downloadBlob(await exportFramePng(doc, frameIndex, scale), `${name}.png`);
      if (kind === 'sheet') downloadBlob(await exportSpritesheet(doc, scale), `${name}-sheet.png`);
      if (kind === 'gif') downloadBlob(exportGif(doc, scale), `${name}.gif`);
      toast.success(t('export.done'));
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('export.title')}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={run} disabled={busy}>
            <Download size={16} />
            {t('export.download')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="label">{t('export.format')}</div>
          <Segmented<ExportKind>
            label={t('export.format')}
            value={kind}
            onChange={setKind}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'sheet', label: t('export.sheet') },
              { value: 'gif', label: 'GIF' },
            ]}
          />
          <p className="mt-2 text-sm text-muted">
            {kind === 'png' && t('export.pngHint', { n: frameIndex + 1 })}
            {kind === 'sheet' && t('export.sheetHint', { n: doc.frames.length })}
            {kind === 'gif' && (animated ? t('export.gifHint', { fps: doc.fps }) : t('export.gifStatic'))}
          </p>
        </div>

        <div>
          <div className="label">{t('export.scale')}</div>
          <Segmented<number>
            label={t('export.scale')}
            value={scale}
            onChange={setScale}
            options={scales.map((s) => ({ value: s, label: `×${s}` }))}
          />
          <p className="mt-2 text-sm tabular-nums text-muted">
            {t('export.result', { w: outW, h: outH })}
          </p>
        </div>
      </div>
    </Modal>
  );
}
