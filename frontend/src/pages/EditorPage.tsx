import { ImageUp, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorTopBar } from '../features/editor/EditorTopBar';
import { ExportDialog } from '../features/editor/ExportDialog';
import { LayersPanel } from '../features/editor/LayersPanel';
import { deserializeDoc } from '../features/editor/model';
import { NewCanvasDialog } from '../features/editor/NewCanvasDialog';
import { PalettePanel } from '../features/editor/PalettePanel';
import { PixelCanvas } from '../features/editor/PixelCanvas';
import { ShortcutsDialog, useEditorShortcuts } from '../features/editor/shortcuts';
import { useEditor } from '../features/editor/store';
import { Timeline } from '../features/editor/Timeline';
import { Toolbar } from '../features/editor/Toolbar';
import { useSaveArtwork } from '../features/editor/useSave';
import { UploadDialog } from '../features/upload/UploadDialog';
import { ApiError, api } from '../shared/api/client';
import type { ArtworkDetail } from '../shared/api/types';
import { useT } from '../shared/i18n';
import { cn } from '../shared/lib/misc';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { Spinner } from '../shared/ui/controls';
import { useAuth } from '../store/auth';
import { toast } from '../store/toasts';

type DialogName = 'new' | 'import' | 'export' | 'shortcuts' | null;

/** Завантажує роботу з сервера, якщо в URL є /editor/:id */
function useRemoteArtwork(routeId: number | null) {
  const t = useT();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [imageArtwork, setImageArtwork] = useState<ArtworkDetail | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const load = useCallback(
    async (id: number) => {
      setLoading(true);
      setImageArtwork(null);
      try {
        const artwork = await api.artworks.get(id);
        if (artwork.kind === 'image') {
          setImageArtwork(artwork);
          return;
        }
        const { doc, palette } = deserializeDoc(artwork.data);
        const mine = useAuth.getState().user?.username === artwork.owner;
        useEditor.getState().loadDocument({
          doc,
          palette,
          meta: mine
            ? {
                id: artwork.id,
                title: artwork.title,
                isPublic: artwork.is_public,
                savedAt: artwork.updated_at,
                dirty: false,
              }
            : { id: null, title: t('editor.remixOf', { title: artwork.title }), isPublic: false, dirty: true },
        });
        if (!mine) {
          toast.info(t('editor.remixStarted', { owner: artwork.owner }));
          navigate('/editor', { replace: true });
        }
      } catch (error) {
        const notFound = error instanceof ApiError && error.status === 404;
        toast.error(notFound ? t('editor.notFound') : t('error.network'));
        navigate('/editor', { replace: true });
      } finally {
        setLoading(false);
      }
    },
    [navigate, t],
  );

  useEffect(() => {
    if (routeId === null || Number.isNaN(routeId)) {
      setImageArtwork(null);
      return;
    }
    const s = useEditor.getState();
    if (s.meta.id === routeId) return; // уже відкрита (наприклад, щойно збережена)
    if (s.meta.dirty) setPendingId(routeId);
    else void load(routeId);
  }, [routeId, load]);

  return {
    loading,
    imageArtwork,
    clearImage: () => setImageArtwork(null),
    pendingId,
    confirmPending: () => {
      if (pendingId !== null) void load(pendingId);
      setPendingId(null);
    },
    cancelPending: () => {
      setPendingId(null);
      navigate('/editor', { replace: true });
    },
  };
}

export default function EditorPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const routeId = id ? Number(id) : null;
  const remote = useRemoteArtwork(routeId);
  const { save, saving } = useSaveArtwork();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const dirty = useEditor((s) => s.meta.dirty);

  const openExport = useCallback(() => setDialog('export'), []);
  const openHelp = useCallback(() => setDialog('shortcuts'), []);
  useEditorShortcuts({ onSave: save, onExport: openExport, onHelp: openHelp });

  const createDocument = (width: number, height: number, title: string) => {
    useEditor.getState().newDocument(width, height, t('layers.defaultName', { n: 1 }), title);
    setDialog(null);
    if (routeId !== null) navigate('/editor');
  };

  /** Завантажену картинку (kind=image) не можна редагувати напряму — пропонуємо пікселізувати. */
  const importImageArtwork = async () => {
    if (!remote.imageArtwork) return;
    try {
      const blob = await api.artworks.previewBlob(remote.imageArtwork);
      setImportFile(new File([blob], `${remote.imageArtwork.title}.png`, { type: 'image/png' }));
      setDialog('import');
    } catch {
      toast.error(t('error.network'));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <EditorTopBar
        saving={saving}
        onSave={save}
        onNew={() => setDialog('new')}
        onImport={() => {
          setImportFile(null);
          setDialog('import');
        }}
        onExport={openExport}
        onShortcuts={openHelp}
        onTogglePanels={() => setPanelsOpen((v) => !v)}
      />

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="order-2 shrink-0 border-t border-line lg:order-1 lg:border-t-0">
          <Toolbar />
        </div>

        <div className="relative order-1 min-h-0 flex-1 lg:order-2">
          <PixelCanvas />
          {remote.loading && (
            <div className="absolute inset-0 grid place-items-center bg-bg/60">
              <Spinner size={28} />
            </div>
          )}
          {remote.imageArtwork && (
            <div className="absolute inset-0 grid place-items-center bg-bg/80 p-6">
              <div className="panel max-w-sm p-6 text-center shadow-pop">
                <ImageUp size={28} className="mx-auto text-muted" />
                <h2 className="mt-3 font-semibold">{remote.imageArtwork.title}</h2>
                <p className="mt-2 text-sm text-muted">{t('editor.imageArtworkHint')}</p>
                <div className="mt-5 flex justify-center gap-2">
                  <button type="button" className="btn-ghost" onClick={() => navigate('/editor')}>
                    {t('common.cancel')}
                  </button>
                  <button type="button" className="btn-primary" onClick={importImageArtwork}>
                    {t('upload.openInEditor')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Права панель; на мобільному — висувна шторка знизу */}
        <aside
          className={cn(
            'scrollbar-thin z-30 overflow-y-auto border-line bg-surface lg:order-3 lg:block lg:w-72 lg:border-l',
            'fixed inset-x-0 bottom-0 max-h-[65dvh] rounded-t-md border-t-2 shadow-pop transition-transform duration-200 lg:static lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:shadow-none',
            panelsOpen ? 'translate-y-0' : 'translate-y-full',
          )}
          aria-label={t('editor.panels')}
        >
          <div className="flex items-center justify-between px-3 pt-2 lg:hidden">
            <span className="text-sm font-semibold">{t('editor.panels')}</span>
            <button type="button" className="icon-btn" onClick={() => setPanelsOpen(false)} aria-label={t('common.close')}>
              <X size={18} />
            </button>
          </div>
          <PalettePanel />
          <div className="mx-3 h-px bg-line" />
          <LayersPanel />
        </aside>
      </div>

      <Timeline />

      <NewCanvasDialog
        open={dialog === 'new'}
        onClose={() => setDialog(null)}
        onCreate={createDocument}
        warnUnsaved={dirty}
      />
      <UploadDialog
        open={dialog === 'import'}
        onClose={() => {
          setDialog(null);
          remote.clearImage();
        }}
        defaultMode="editor"
        initialFile={importFile}
      />
      <ExportDialog open={dialog === 'export'} onClose={() => setDialog(null)} />
      <ShortcutsDialog open={dialog === 'shortcuts'} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={remote.pendingId !== null}
        title={t('editor.discardTitle')}
        message={t('editor.discardMessage')}
        confirmLabel={t('editor.discardConfirm')}
        danger
        onConfirm={remote.confirmPending}
        onCancel={remote.cancelPending}
      />
    </div>
  );
}
