import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useT } from '../../shared/i18n';
import { cn } from '../../shared/lib/misc';
import { IconButton } from '../../shared/ui/controls';
import { PixelImage } from '../../shared/ui/PixelImage';
import { compositeFrame, type LayerMeta, MAX_LAYERS } from './model';
import { useEditor } from './store';

const LayerThumb = memo(function LayerThumb({ layerId }: { layerId: string }) {
  const doc = useEditor((s) => s.doc);
  const frameIndex = useEditor((s) => s.frameIndex);
  const cel = doc.frames[frameIndex]?.cels[layerId];
  // Перераховуємо мініатюру лише коли змінився саме цей шар
  const rgba = useMemo(
    () => compositeFrame(doc, frameIndex, { layerIds: [layerId], includeHidden: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cel, doc.width, doc.height],
  );
  return (
    <span className="checker block h-8 w-8 shrink-0 overflow-hidden rounded-[2px] border border-line">
      <PixelImage rgba={rgba} width={doc.width} height={doc.height} className="h-full w-full object-contain" />
    </span>
  );
});

function LayerRow({ layer, active }: { layer: LayerMeta; active: boolean }) {
  const t = useT();
  const { selectLayer, toggleLayerVisibility, renameLayer } = useEditor.getState();
  const [editing, setEditing] = useState(false);

  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-px px-1.5 py-1',
        active ? 'bg-accent/20 ring-1 ring-accent' : 'hover:bg-surface-2',
      )}
    >
      <button
        type="button"
        className="icon-btn h-7 w-7"
        onClick={() => toggleLayerVisibility(layer.id)}
        aria-label={layer.visible ? t('layers.hide') : t('layers.show')}
        title={layer.visible ? t('layers.hide') : t('layers.show')}
      >
        {layer.visible ? <Eye size={15} /> : <EyeOff size={15} className="opacity-50" />}
      </button>
      <button type="button" onClick={() => selectLayer(layer.id)} className="shrink-0" tabIndex={-1} aria-hidden>
        <LayerThumb layerId={layer.id} />
      </button>
      {editing ? (
        <input
          autoFocus
          defaultValue={layer.name}
          maxLength={32}
          className="input min-w-0 flex-1 px-1.5 py-0.5 text-sm"
          onBlur={(e) => {
            renameLayer(layer.id, e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label={t('layers.rename')}
        />
      ) : (
        <button
          type="button"
          className={cn('min-w-0 flex-1 truncate text-left text-sm', !layer.visible && 'text-muted line-through')}
          onClick={() => selectLayer(layer.id)}
          onDoubleClick={() => setEditing(true)}
          aria-current={active}
          title={t('layers.renameHint')}
        >
          {layer.name}
        </button>
      )}
      {layer.opacity < 1 && <span className="text-xs tabular-nums text-muted">{Math.round(layer.opacity * 100)}%</span>}
    </li>
  );
}

export function LayersPanel() {
  const t = useT();
  const layers = useEditor((s) => s.doc.layers);
  const layerId = useEditor((s) => s.layerId);
  const { addLayer, duplicateLayer, deleteLayer, moveLayer, setLayerOpacity } = useEditor.getState();
  const index = layers.findIndex((l) => l.id === layerId);
  const active = layers[index];

  return (
    <section aria-labelledby="layers-title">
      <div className="panel-title">
        <h3 id="layers-title">{t('layers.title')}</h3>
        <div className="flex items-center">
          <IconButton
            icon={Plus}
            label={t('layers.add')}
            onClick={() => addLayer(t('layers.defaultName', { n: layers.length + 1 }))}
            disabled={layers.length >= MAX_LAYERS}
            size={16}
            className="h-7 w-7"
          />
          <IconButton
            icon={Copy}
            label={t('layers.duplicate')}
            onClick={() => duplicateLayer(t('layers.copySuffix'))}
            disabled={layers.length >= MAX_LAYERS}
            size={16}
            className="h-7 w-7"
          />
          <IconButton
            icon={ChevronUp}
            label={t('layers.up')}
            onClick={() => moveLayer(layerId, 1)}
            disabled={index >= layers.length - 1}
            size={16}
            className="h-7 w-7"
          />
          <IconButton
            icon={ChevronDown}
            label={t('layers.down')}
            onClick={() => moveLayer(layerId, -1)}
            disabled={index <= 0}
            size={16}
            className="h-7 w-7"
          />
          <IconButton
            icon={Trash2}
            label={t('layers.delete')}
            onClick={() => deleteLayer(layerId)}
            disabled={layers.length <= 1}
            size={16}
            className="h-7 w-7"
            tooltipSide="left"
          />
        </div>
      </div>

      <ul className="flex flex-col gap-0.5 px-2">
        {/* Верхній шар показуємо першим, як у Photoshop/Aseprite */}
        {[...layers].reverse().map((layer) => (
          <LayerRow key={layer.id} layer={layer} active={layer.id === layerId} />
        ))}
      </ul>

      {active && (
        <label className="flex items-center gap-3 px-3 pb-3 pt-2 text-xs text-muted">
          {t('layers.opacity')}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(active.opacity * 100)}
            onChange={(e) => setLayerOpacity(active.id, Number(e.target.value) / 100)}
            className="flex-1 accent-[rgb(var(--teal))]"
          />
          <span className="w-8 text-right tabular-nums text-ink">{Math.round(active.opacity * 100)}%</span>
        </label>
      )}
    </section>
  );
}
