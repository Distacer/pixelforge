import { Copy, FilePlus2, Globe, ImageUp, Lock, PenLine, PenTool, Search, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewCanvasDialog } from '../features/editor/NewCanvasDialog';
import { useEditor } from '../features/editor/store';
import { ArtworkCard, ArtworkGrid, ArtworkGridSkeleton } from '../features/gallery/ArtworkCard';
import { ArtworkViewer } from '../features/gallery/ArtworkViewer';
import { ListError, ListFooter } from '../features/gallery/ListStates';
import { useArtworkList } from '../features/gallery/useArtworkList';
import { UploadDialog } from '../features/upload/UploadDialog';
import { ApiError, api } from '../shared/api/client';
import type { Artwork } from '../shared/api/types';
import { useDebounced } from '../shared/hooks/useDebounced';
import { useT } from '../shared/i18n';
import { formatDate } from '../shared/lib/misc';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { EmptyState } from '../shared/ui/controls';
import { Modal } from '../shared/ui/Modal';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { toast } from '../store/toasts';

function RenameDialog({
  artwork,
  onClose,
  onSaved,
}: {
  artwork: Artwork | null;
  onClose: () => void;
  onSaved: (artwork: Artwork) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const submit = async (title: string) => {
    if (!artwork || !title.trim()) return;
    setBusy(true);
    try {
      onSaved(await api.artworks.update(artwork.id, { title: title.trim() }));
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError && e.status ? e.message : t('error.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={artwork !== null}
      onClose={onClose}
      title={t('artwork.rename')}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="rename-form" className="btn-primary" disabled={busy}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form
        id="rename-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(new FormData(e.currentTarget).get('title') as string);
        }}
      >
        <label className="label" htmlFor="rename-title">
          {t('upload.name')}
        </label>
        <input
          id="rename-title"
          name="title"
          className="input"
          defaultValue={artwork?.title}
          maxLength={80}
          required
          data-autofocus
        />
      </form>
    </Modal>
  );
}

export function MyWorksPage() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const draftDirty = useEditor((s) => s.meta.dirty);

  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const fetchPage = useCallback(
    (offset: number, limit: number) => api.artworks.mine({ q, offset, limit, sort: 'updated' }),
    [q],
  );
  const list = useArtworkList(fetchPage);

  const [viewing, setViewing] = useState<Artwork | null>(null);
  const [renaming, setRenaming] = useState<Artwork | null>(null);
  const [deleting, setDeleting] = useState<Artwork | null>(null);
  const [dialog, setDialog] = useState<'new' | 'upload' | 'deleteAccount' | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => toast.error(e instanceof ApiError && e.status ? e.message : t('error.network'));

  const open = (artwork: Artwork) => {
    if (artwork.kind === 'pixel') navigate(`/editor/${artwork.id}`);
    else setViewing(artwork);
  };

  const togglePublic = async (artwork: Artwork) => {
    try {
      const updated = await api.artworks.update(artwork.id, { is_public: !artwork.is_public });
      list.update(updated);
      toast.success(updated.is_public ? t('artwork.nowPublic') : t('artwork.nowPrivate'));
    } catch (e) {
      fail(e);
    }
  };

  const duplicate = async (artwork: Artwork) => {
    try {
      list.prepend(await api.artworks.duplicate(artwork.id, t('artwork.copyTitle', { title: artwork.title })));
      toast.success(t('artwork.duplicated'));
    } catch (e) {
      fail(e);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.artworks.remove(deleting.id);
      list.remove(deleting.id);
      // Якщо видалили роботу, відкриту в редакторі, — відв'язуємо чернетку від неї
      const editor = useEditor.getState();
      if (editor.meta.id === deleting.id) editor.setMeta({ id: null, dirty: true });
      toast.success(t('artwork.deleted'));
      setDeleting(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.users.deleteMe();
      logout();
      toast.info(t('account.deleted'));
      navigate('/');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pt-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-pixel text-3xl sm:text-4xl">{t('nav.myWorks')}</h1>
          <p className="mt-2 text-muted">
            {t('myWorks.count', { n: list.total })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setDialog('upload')}>
            <ImageUp size={16} />
            {t('upload.title')}
          </button>
          <button type="button" className="btn-primary" onClick={() => setDialog('new')}>
            <FilePlus2 size={16} />
            {t('editor.new')}
          </button>
        </div>
      </header>

      <label className="relative mt-8 block max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('gallery.search')}
          className="input pl-9"
          aria-label={t('gallery.search')}
        />
      </label>

      <div className="mt-8">
        {list.error && list.items.length === 0 ? (
          <ListError onRetry={list.reload} />
        ) : list.loading && list.items.length === 0 ? (
          <ArtworkGridSkeleton />
        ) : list.items.length === 0 ? (
          <EmptyState
            title={q ? t('gallery.nothingFound') : t('myWorks.empty')}
            description={q ? t('gallery.nothingFoundHint') : t('myWorks.emptyHint')}
            action={
              !q && (
                <button type="button" className="btn-primary" onClick={() => setDialog('new')}>
                  {t('editor.new')}
                </button>
              )
            }
          />
        ) : (
          <>
            <ArtworkGrid>
              {list.items.map((artwork) => (
                <ArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  onOpen={open}
                  onChange={list.update}
                  showOwner={false}
                  showPrivacy
                  menu={[
                    {
                      label: artwork.kind === 'pixel' ? t('artwork.edit') : t('artwork.view'),
                      icon: PenTool,
                      onSelect: () => open(artwork),
                    },
                    { label: t('artwork.rename'), icon: PenLine, onSelect: () => setRenaming(artwork) },
                    {
                      label: artwork.is_public ? t('artwork.makePrivate') : t('artwork.makePublic'),
                      icon: artwork.is_public ? Lock : Globe,
                      onSelect: () => void togglePublic(artwork),
                    },
                    { label: t('artwork.duplicate'), icon: Copy, onSelect: () => void duplicate(artwork) },
                    'divider',
                    { label: t('common.delete'), icon: Trash2, danger: true, onSelect: () => setDeleting(artwork) },
                  ]}
                />
              ))}
            </ArtworkGrid>
            <ListFooter loading={list.loading} hasMore={list.hasMore} onMore={list.loadMore} />
          </>
        )}
      </div>

      {user && (
        <section className="mt-20 border-t border-line pt-8" aria-labelledby="account-title">
          <h2 id="account-title" className="text-lg font-semibold">
            {t('account.title')}
          </h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {t('account.signedInAs', { name: user.username, date: formatDate(user.created_at, lang) })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                {t('auth.logout')}
              </button>
              <button type="button" className="btn-ghost text-danger" onClick={() => setDialog('deleteAccount')}>
                {t('account.delete')}
              </button>
            </div>
          </div>
        </section>
      )}

      <NewCanvasDialog
        open={dialog === 'new'}
        onClose={() => setDialog(null)}
        warnUnsaved={draftDirty}
        onCreate={(w, h, title) => {
          useEditor.getState().newDocument(w, h, t('layers.defaultName', { n: 1 }), title);
          setDialog(null);
          navigate('/editor');
        }}
      />
      <UploadDialog
        open={dialog === 'upload'}
        onClose={() => setDialog(null)}
        defaultMode="gallery"
        onUploaded={list.prepend}
      />
      <ArtworkViewer artwork={viewing} onClose={() => setViewing(null)} onChange={list.update} />
      <RenameDialog artwork={renaming} onClose={() => setRenaming(null)} onSaved={list.update} />
      <ConfirmDialog
        open={deleting !== null}
        title={t('artwork.deleteTitle')}
        message={t('artwork.deleteMessage', { title: deleting?.title ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={dialog === 'deleteAccount'}
        title={t('account.deleteTitle')}
        message={t('account.deleteMessage')}
        confirmLabel={t('account.delete')}
        danger
        busy={busy}
        onConfirm={deleteAccount}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
