import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../../shared/i18n';
import { isValidHex, normalizeHex } from '../../shared/lib/color';
import { cn } from '../../shared/lib/misc';
import { CUSTOM_PALETTE_ID, PALETTES } from './palettes';
import { selectPaletteColors, useEditor } from './store';

function Swatch({
  color,
  active,
  onPick,
  onRemove,
  label,
}: {
  color: string;
  active: boolean;
  onPick: (secondary: boolean) => void;
  onRemove?: () => void;
  label: string;
}) {
  return (
    <span className="group relative">
      <button
        type="button"
        onClick={() => onPick(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          onPick(true);
        }}
        className={cn(
          'block h-7 w-full rounded-[2px] border border-black/10 transition-transform hover:scale-110 hover:z-10',
          active && 'ring-2 ring-accent ring-offset-1 ring-offset-surface',
        )}
        style={{ background: color }}
        aria-label={label}
        title={`${color} — ${label}`}
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1 -top-1 hidden h-4 w-4 place-items-center rounded-full bg-[rgb(var(--shadow))] text-white group-hover:grid"
          aria-label="×"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

export function PalettePanel() {
  const t = useT();
  const { primary, paletteId, recent, customPalette } = useEditor(
    useShallow((s) => ({
      primary: s.primary,
      paletteId: s.paletteId,
      recent: s.recent,
      customPalette: s.customPalette,
    })),
  );
  const colors = useEditor(useShallow(selectPaletteColors));
  const { setPrimary, setSecondary, setPaletteId, addToCustomPalette, removeFromCustomPalette } =
    useEditor.getState();

  const [hexDraft, setHexDraft] = useState(primary);
  useEffect(() => setHexDraft(primary), [primary]);

  const pick = (color: string) => (secondary: boolean) => (secondary ? setSecondary : setPrimary)(color);
  const isCustom = paletteId === CUSTOM_PALETTE_ID;

  return (
    <section aria-labelledby="palette-title">
      <div className="panel-title">
        <h3 id="palette-title">{t('editor.palette')}</h3>
        <select
          value={paletteId}
          onChange={(e) => setPaletteId(e.target.value)}
          className="rounded-px border border-line bg-surface px-1.5 py-0.5 text-xs font-normal text-ink"
          aria-label={t('editor.paletteSelect')}
        >
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={CUSTOM_PALETTE_ID}>{t('editor.customPalette')}</option>
        </select>
      </div>

      <div className="px-3 pb-3">
        <div className="grid grid-cols-8 gap-1">
          {colors.map((color) => (
            <Swatch
              key={color}
              color={color}
              active={color === primary}
              onPick={pick(color)}
              onRemove={isCustom ? () => removeFromCustomPalette(color) : undefined}
              label={t('editor.swatchHint')}
            />
          ))}
          {isCustom && (
            <button
              type="button"
              onClick={() => addToCustomPalette(primary)}
              disabled={customPalette.includes(primary)}
              className="grid h-7 place-items-center rounded-[2px] border border-dashed border-line text-muted hover:border-ink hover:text-ink disabled:opacity-40"
              aria-label={t('editor.addColor')}
              title={t('editor.addColor')}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        {isCustom && customPalette.length === 0 && (
          <p className="mt-2 text-xs text-muted">{t('editor.customEmpty')}</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <label className="relative h-8 w-8 shrink-0 cursor-pointer rounded-[2px] border-2 border-[rgb(var(--shadow))]" style={{ background: primary }}>
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="sr-only"
              aria-label={t('editor.primary')}
            />
          </label>
          <input
            className="input py-1.5 font-mono text-xs uppercase"
            value={hexDraft}
            onChange={(e) => {
              setHexDraft(e.target.value);
              if (isValidHex(e.target.value)) setPrimary(normalizeHex(e.target.value));
            }}
            onBlur={() => setHexDraft(primary)}
            spellCheck={false}
            maxLength={7}
            aria-label="HEX"
          />
          {!isCustom && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => addToCustomPalette(primary)}
              aria-label={t('editor.addColor')}
              title={t('editor.addColor')}
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {recent.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-xs text-muted">{t('editor.recent')}</div>
            <div className="grid grid-cols-8 gap-1">
              {recent.slice(0, 8).map((color) => (
                <Swatch
                  key={color}
                  color={color}
                  active={color === primary}
                  onPick={pick(color)}
                  label={t('editor.swatchHint')}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
