import { ArrowLeftRight, Droplet, FlipHorizontal2 } from 'lucide-react';
import { useT } from '../../shared/i18n';
import { cn } from '../../shared/lib/misc';
import { IconButton } from '../../shared/ui/controls';
import { useEditor } from './store';
import { TOOLS } from './tools';

/** Ліва панель інструментів (на мобільному — горизонтальна смуга знизу). */
export function Toolbar() {
  const t = useT();
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const brushSize = useEditor((s) => s.brushSize);
  const setBrushSize = useEditor((s) => s.setBrushSize);
  const mirrorX = useEditor((s) => s.mirrorX);
  const toggleMirror = useEditor((s) => s.toggleMirror);
  const shapeFilled = useEditor((s) => s.shapeFilled);
  const toggleShapeFilled = useEditor((s) => s.toggleShapeFilled);

  const usesBrush = tool === 'pencil' || tool === 'eraser' || tool === 'line';
  const isShape = tool === 'rect' || tool === 'ellipse';

  return (
    <div
      className="scrollbar-thin flex items-center gap-1 overflow-x-auto border-line bg-surface px-2 py-1.5 lg:h-full lg:flex-col lg:overflow-visible lg:border-r lg:px-1.5 lg:py-2"
      role="toolbar"
      aria-label={t('editor.tools')}
    >
      {TOOLS.map((def) => (
        <IconButton
          key={def.id}
          icon={def.icon}
          label={t(def.label)}
          shortcut={def.key}
          pressed={tool === def.id}
          onClick={() => setTool(def.id)}
          tooltipSide="right"
        />
      ))}

      <div className="mx-1 h-6 w-px bg-line lg:mx-0 lg:my-1 lg:h-px lg:w-6" />

      <IconButton
        icon={FlipHorizontal2}
        label={t('editor.mirror')}
        shortcut="M"
        pressed={mirrorX}
        onClick={toggleMirror}
        tooltipSide="right"
      />
      <IconButton
        icon={Droplet}
        label={t('editor.filled')}
        shortcut="F"
        pressed={shapeFilled}
        onClick={toggleShapeFilled}
        disabled={!isShape}
        tooltipSide="right"
      />

      <div
        className={cn(
          'flex items-center gap-1 rounded-px px-1 lg:flex-col',
          !usesBrush && 'pointer-events-none opacity-40',
        )}
        aria-label={t('editor.brushSize')}
      >
        {[1, 2, 3, 4].map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setBrushSize(size)}
            aria-pressed={brushSize === size}
            aria-label={`${t('editor.brushSize')}: ${size}`}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-px transition-colors',
              brushSize === size ? 'bg-surface-2 ring-2 ring-accent' : 'hover:bg-surface-2',
            )}
          >
            <span className="bg-ink" style={{ width: 2 + size * 3, height: 2 + size * 3 }} />
          </button>
        ))}
      </div>

      <div className="ml-auto lg:ml-0 lg:mt-auto">
        <ColorSwatches />
      </div>
    </div>
  );
}

/** Основний і додатковий колір, як у класичних редакторах. */
export function ColorSwatches() {
  const t = useT();
  const primary = useEditor((s) => s.primary);
  const secondary = useEditor((s) => s.secondary);
  const setPrimary = useEditor((s) => s.setPrimary);
  const setSecondary = useEditor((s) => s.setSecondary);
  const swap = useEditor((s) => s.swapColors);

  return (
    <div className="relative h-11 w-11 shrink-0">
      <label
        className="absolute bottom-0 right-0 h-7 w-7 cursor-pointer rounded-[2px] border-2 border-[rgb(var(--shadow))]"
        style={{ background: secondary }}
        title={t('editor.secondary')}
      >
        <input
          type="color"
          value={secondary}
          onChange={(e) => setSecondary(e.target.value)}
          className="sr-only"
          aria-label={t('editor.secondary')}
        />
      </label>
      <label
        className="absolute left-0 top-0 h-7 w-7 cursor-pointer rounded-[2px] border-2 border-[rgb(var(--shadow))] shadow-pixel-sm"
        style={{ background: primary }}
        title={t('editor.primary')}
      >
        <input
          type="color"
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
          className="sr-only"
          aria-label={t('editor.primary')}
        />
      </label>
      <button
        type="button"
        onClick={swap}
        className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-[2px] text-muted hover:text-ink"
        aria-label={`${t('editor.swapColors')} (X)`}
        title={`${t('editor.swapColors')} (X)`}
      >
        <ArrowLeftRight size={11} />
      </button>
    </div>
  );
}
