/**
 * Гарячі клавіші редактора. Використовуємо KeyboardEvent.code (фізична клавіша),
 * тому «B» працює і на українській розкладці, де ця клавіша друкує «И».
 */

import { useEffect } from 'react';
import { type TKey, useT } from '../../shared/i18n';
import { isTypingTarget } from '../../shared/lib/misc';
import { Modal } from '../../shared/ui/Modal';
import { canvasControls } from './PixelCanvas';
import { useEditor } from './store';
import { TOOLS } from './tools';

interface ShortcutHandlers {
  onSave: () => void;
  onExport: () => void;
  onHelp: () => void;
}

export function useEditorShortcuts({ onSave, onExport, onHelp }: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || document.querySelector('[role="dialog"]')) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const handled = (() => {
          switch (e.code) {
            case 'KeyZ':
              if (e.shiftKey) s.redo();
              else s.undo();
              return true;
            case 'KeyY':
              s.redo();
              return true;
            case 'KeyS':
              onSave();
              return true;
            case 'KeyE':
              onExport();
              return true;
            default:
              return false;
          }
        })();
        if (handled) e.preventDefault();
        return;
      }
      if (e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) s.setSpaceDown(true);
        return;
      }

      if (e.shiftKey) {
        if (e.code === 'KeyG') s.toggleGrid();
        else if (e.code === 'KeyO') s.toggleOnion();
        else if (e.code === 'Slash') onHelp();
        else return;
        e.preventDefault();
        return;
      }

      const tool = TOOLS.find((def) => def.code === e.code);
      if (tool) {
        s.setTool(tool.id);
        return;
      }

      switch (e.code) {
        case 'KeyX':
          s.swapColors();
          break;
        case 'KeyM':
          s.toggleMirror();
          break;
        case 'KeyF':
          s.toggleShapeFilled();
          break;
        case 'BracketLeft':
          s.setBrushSize(s.brushSize - 1);
          break;
        case 'BracketRight':
          s.setBrushSize(s.brushSize + 1);
          break;
        case 'Comma':
          s.stepFrame(-1);
          break;
        case 'Period':
          s.stepFrame(1);
          break;
        case 'Enter':
          s.setPlaying(!s.playing);
          break;
        case 'Equal':
        case 'NumpadAdd':
          canvasControls.zoomBy(1);
          break;
        case 'Minus':
        case 'NumpadSubtract':
          canvasControls.zoomBy(-1);
          break;
        case 'Digit0':
        case 'Numpad0':
          canvasControls.fit();
          break;
        case 'Delete':
        case 'Backspace':
          s.clearLayer();
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') useEditor.getState().setSpaceDown(false);
    };
    const onBlur = () => useEditor.getState().setSpaceDown(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [onSave, onExport, onHelp]);
}

const GROUPS: Array<{ title: TKey; items: Array<[keys: string, label: TKey]> }> = [
  {
    title: 'shortcuts.tools',
    items: TOOLS.map((tool) => [tool.key, tool.label] as [string, TKey]),
  },
  {
    title: 'shortcuts.drawing',
    items: [
      ['X', 'editor.swapColors'],
      ['M', 'editor.mirror'],
      ['F', 'editor.filled'],
      ['[  ]', 'editor.brushSize'],
      ['Alt + click', 'tool.picker'],
      ['Shift', 'shortcuts.constrain'],
      ['G + Shift + click', 'shortcuts.fillAll'],
      ['Delete', 'editor.clearLayer'],
    ],
  },
  {
    title: 'shortcuts.view',
    items: [
      ['+  −', 'shortcuts.zoom'],
      ['0', 'editor.fit'],
      ['Space + drag', 'tool.hand'],
      ['Shift + G', 'editor.grid'],
      ['Shift + O', 'timeline.onion'],
    ],
  },
  {
    title: 'shortcuts.document',
    items: [
      ['Ctrl + Z', 'editor.undo'],
      ['Ctrl + Shift + Z', 'editor.redo'],
      ['Ctrl + S', 'editor.save'],
      ['Ctrl + E', 'export.title'],
      [',  .', 'shortcuts.frames'],
      ['Enter', 'timeline.play'],
      ['Shift + ?', 'shortcuts.title'],
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={t('shortcuts.title')} size="lg">
      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-sm font-semibold">{t(group.title)}</h3>
            <dl className="flex flex-col gap-1.5 text-sm">
              {group.items.map(([keys, label]) => (
                <div key={keys + label} className="flex items-center justify-between gap-4">
                  <dt className="text-muted">{t(label)}</dt>
                  <dd>
                    <kbd className="rounded-[2px] border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs">
                      {keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
