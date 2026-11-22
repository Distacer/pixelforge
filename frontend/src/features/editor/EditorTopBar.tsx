import {
  Cloud,
  Download,
  Ellipsis,
  Eraser,
  FilePlus2,
  FlipHorizontal2,
  FlipVertical2,
  Globe,
  Grid3x3,
  ImageUp,
  Keyboard,
  Lock,
  PanelRight,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useT } from '../../shared/i18n';
import { cn } from '../../shared/lib/misc';
import { IconButton, Spinner } from '../../shared/ui/controls';
import { Menu } from '../../shared/ui/Menu';
import { useSettings } from '../../store/settings';
import { useEditor } from './store';

interface EditorTopBarProps {
  saving: boolean;
  onSave: () => void;
  onNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onShortcuts: () => void;
  onTogglePanels: () => void;
}

function SaveStatus() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const meta = useEditor((s) => s.meta);
  let text: string;
  if (meta.id === null) text = t('editor.statusDraft');
  else if (meta.dirty) text = t('editor.statusUnsaved');
  else if (meta.savedAt) {
    const time = new Date(meta.savedAt).toLocaleTimeString(lang === 'uk' ? 'uk-UA' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    text = t('editor.statusSaved', { time });
  } else text = t('editor.statusSavedPlain');

  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex" aria-live="polite">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          meta.id !== null && !meta.dirty ? 'bg-teal' : 'bg-accent',
        )}
      />
      {text}
    </span>
  );
}

export function EditorTopBar({
  saving,
  onSave,
  onNew,
  onImport,
  onExport,
  onShortcuts,
  onTogglePanels,
}: EditorTopBarProps) {
  const t = useT();
  const title = useEditor((s) => s.meta.title);
  const isPublic = useEditor((s) => s.meta.isPublic);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const showGrid = useEditor((s) => s.showGrid);
  const { setMeta, undo, redo, toggleGrid, flipLayer, clearLayer } = useEditor.getState();

  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface px-2 py-1.5 sm:px-3">
      <input
        value={title}
        onChange={(e) => setMeta({ title: e.target.value, dirty: true })}
        placeholder={t('editor.untitled')}
        maxLength={80}
        aria-label={t('editor.titleLabel')}
        className="w-36 min-w-0 rounded-px border-2 border-transparent bg-transparent px-2 py-1 text-sm font-semibold hover:border-line focus:border-accent focus:outline-none sm:w-56"
      />
      <SaveStatus />

      <div className="ml-auto flex items-center gap-0.5">
        <IconButton icon={Undo2} label={t('editor.undo')} shortcut="Ctrl+Z" onClick={undo} disabled={!canUndo} />
        <IconButton icon={Redo2} label={t('editor.redo')} shortcut="Ctrl+Shift+Z" onClick={redo} disabled={!canRedo} />
        <IconButton
          icon={Grid3x3}
          label={t('editor.grid')}
          shortcut="Shift+G"
          pressed={showGrid}
          onClick={toggleGrid}
          className="hidden sm:inline-flex"
        />
        <IconButton
          icon={isPublic ? Globe : Lock}
          label={isPublic ? t('artwork.makePrivate') : t('artwork.makePublic')}
          onClick={() => setMeta({ isPublic: !isPublic, dirty: true })}
        />
        <IconButton icon={PanelRight} label={t('editor.panels')} onClick={onTogglePanels} className="lg:hidden" />

        <Menu
          trigger={(props) => (
            <button type="button" className="icon-btn" aria-label={t('common.more')} {...props}>
              <Ellipsis size={18} />
            </button>
          )}
          items={[
            { label: t('editor.new'), icon: FilePlus2, onSelect: onNew },
            { label: t('upload.importPng'), icon: ImageUp, onSelect: onImport },
            { label: t('export.title'), icon: Download, hint: 'Ctrl+E', onSelect: onExport },
            'divider',
            { label: t('editor.flipH'), icon: FlipHorizontal2, onSelect: () => flipLayer('x') },
            { label: t('editor.flipV'), icon: FlipVertical2, onSelect: () => flipLayer('y') },
            { label: t('editor.clearLayer'), icon: Eraser, hint: 'Del', danger: true, onSelect: clearLayer },
            'divider',
            { label: t('shortcuts.title'), icon: Keyboard, hint: '?', onSelect: onShortcuts },
          ]}
        />

        <button type="button" className="btn-primary ml-1.5 px-3 py-1.5" onClick={onSave} disabled={saving}>
          {saving ? <Spinner size={16} /> : <Cloud size={16} />}
          <span className="hidden sm:inline">{t('editor.save')}</span>
        </button>
      </div>
    </div>
  );
}
