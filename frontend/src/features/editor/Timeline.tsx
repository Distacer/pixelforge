import { ChevronLeft, ChevronRight, Copy, Ghost, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { memo, useEffect, useMemo } from 'react';
import { useT } from '../../shared/i18n';
import { cn } from '../../shared/lib/misc';
import { IconButton } from '../../shared/ui/controls';
import { PixelImage } from '../../shared/ui/PixelImage';
import { compositeFrame, MAX_FRAMES } from './model';
import { useEditor } from './store';

const FrameThumb = memo(function FrameThumb({ index }: { index: number }) {
  const doc = useEditor((s) => s.doc);
  const frame = doc.frames[index];
  const rgba = useMemo(
    () => compositeFrame(doc, index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame, doc.layers, doc.width, doc.height],
  );
  return <PixelImage rgba={rgba} width={doc.width} height={doc.height} className="h-full w-full object-contain" />;
});

/** Відтворення анімації: просто перемикаємо поточний кадр із заданим FPS. */
function usePlayback() {
  const playing = useEditor((s) => s.playing);
  const fps = useEditor((s) => s.doc.fps);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => useEditor.getState().stepFrame(1), 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, fps]);
}

export function Timeline() {
  const t = useT();
  usePlayback();
  const frames = useEditor((s) => s.doc.frames);
  const fps = useEditor((s) => s.doc.fps);
  const frameIndex = useEditor((s) => s.frameIndex);
  const playing = useEditor((s) => s.playing);
  const onionSkin = useEditor((s) => s.onionSkin);
  const { addFrame, duplicateFrame, deleteFrame, moveFrame, selectFrame, setFps, setPlaying, toggleOnion } =
    useEditor.getState();

  return (
    <section
      className="flex items-center gap-2 border-t border-line bg-surface px-2 py-2"
      aria-label={t('timeline.title')}
    >
      <div className="flex shrink-0 items-center">
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? t('timeline.pause') : t('timeline.play')}
          shortcut="Enter"
          onClick={() => setPlaying(!playing)}
          disabled={frames.length < 2}
          tooltipSide="top"
        />
        <IconButton
          icon={Ghost}
          label={t('timeline.onion')}
          shortcut="Shift+O"
          pressed={onionSkin}
          onClick={toggleOnion}
          tooltipSide="top"
        />
        <label className="ml-1 hidden items-center gap-1.5 text-xs text-muted sm:flex">
          FPS
          <input
            type="number"
            min={1}
            max={30}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value) || 1)}
            className="input w-14 px-1.5 py-1 text-xs"
          />
        </label>
      </div>

      <ol className="scrollbar-thin flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1" aria-label={t('timeline.frames')}>
        {frames.map((frame, i) => (
          <li key={frame.id} className="shrink-0">
            <button
              type="button"
              onClick={() => selectFrame(i)}
              aria-current={i === frameIndex}
              aria-label={t('timeline.frame', { n: i + 1 })}
              className={cn(
                'checker relative block h-12 w-12 overflow-hidden rounded-[2px] border-2 transition-colors',
                i === frameIndex ? 'border-accent' : 'border-line hover:border-ink/40',
              )}
            >
              <FrameThumb index={i} />
              <span className="absolute bottom-0 right-0 bg-[rgb(var(--shadow)/0.75)] px-1 text-[10px] leading-4 text-white">
                {i + 1}
              </span>
            </button>
          </li>
        ))}
        <li className="shrink-0">
          <button
            type="button"
            onClick={addFrame}
            disabled={frames.length >= MAX_FRAMES}
            className="grid h-12 w-12 place-items-center rounded-[2px] border-2 border-dashed border-line text-muted hover:border-ink hover:text-ink disabled:opacity-40"
            aria-label={t('timeline.add')}
            title={t('timeline.add')}
          >
            <Plus size={18} />
          </button>
        </li>
      </ol>

      <div className="flex shrink-0 items-center">
        <IconButton
          icon={ChevronLeft}
          label={t('timeline.moveLeft')}
          onClick={() => moveFrame(frameIndex, frameIndex - 1)}
          disabled={frameIndex === 0}
          tooltipSide="top"
        />
        <IconButton
          icon={ChevronRight}
          label={t('timeline.moveRight')}
          onClick={() => moveFrame(frameIndex, frameIndex + 1)}
          disabled={frameIndex >= frames.length - 1}
          tooltipSide="top"
        />
        <IconButton icon={Copy} label={t('timeline.duplicate')} onClick={duplicateFrame} tooltipSide="top" />
        <IconButton
          icon={Trash2}
          label={t('timeline.delete')}
          onClick={() => deleteFrame(frameIndex)}
          disabled={frames.length <= 1}
          tooltipSide="top"
          className="hover:text-danger"
        />
      </div>
    </section>
  );
}
