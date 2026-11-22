import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import type { ArtworkDetail } from '../../shared/api/types';
import { useT } from '../../shared/i18n';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toasts';
import { makePreviewDataUrl } from './exporters';
import { serializeDoc } from './model';
import { selectPaletteColors, useEditor } from './store';

/** Збереження документа на сервер: створює нову роботу або оновлює наявну. */
export function useSaveArtwork() {
  const t = useT();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    if (!useAuth.getState().token) {
      toast.info(t('editor.loginToSave'));
      navigate(`/login?next=${encodeURIComponent('/editor')}`);
      return;
    }

    const s = useEditor.getState();
    const docAtSave = s.doc;
    const title = s.meta.title.trim() || t('editor.untitled');
    const payload = {
      title,
      width: s.doc.width,
      height: s.doc.height,
      frame_count: s.doc.frames.length,
      data: serializeDoc(s.doc, s.paletteId === 'custom' ? selectPaletteColors(s) : undefined),
      preview_png: makePreviewDataUrl(s.doc),
      is_public: s.meta.isPublic,
    };

    inFlight.current = true;
    setSaving(true);
    try {
      let saved: ArtworkDetail;
      if (s.meta.id !== null) {
        try {
          saved = await api.artworks.update(s.meta.id, payload);
        } catch (error) {
          // Роботу видалили або вона чужа — зберігаємо як нову
          if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
            saved = await api.artworks.create(payload);
          } else throw error;
        }
      } else {
        saved = await api.artworks.create(payload);
      }

      useEditor.getState().setMeta({
        id: saved.id,
        title: saved.title,
        isPublic: saved.is_public,
        savedAt: saved.updated_at,
        // Якщо під час збереження продовжували малювати — зміни ще не збережені
        dirty: useEditor.getState().doc !== docAtSave,
      });
      navigate(`/editor/${saved.id}`, { replace: true });
      toast.success(t('editor.saved'));
    } catch (error) {
      const message =
        error instanceof ApiError && error.status !== 0 ? error.message : t('error.network');
      toast.error(message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [navigate, t]);

  return { save, saving };
}
