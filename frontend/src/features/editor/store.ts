/**
 * Стан редактора (Zustand).
 *
 * Історія (undo/redo) — це стек знімків документа. Оскільки ми ніколи не
 * мутуємо документ, а створюємо новий з тими самими незміненими масивами,
 * знімок коштує майже нічого: копіюється лише змінений шар.
 *
 * Чернетка автоматично зберігається в localStorage (див. кінець файлу),
 * тож після перезавантаження сторінки малюнок нікуди не дінеться.
 */

import { create } from 'zustand';
import { t } from '../../shared/i18n';
import { clamp, uid } from '../../shared/lib/misc';
import {
  createDoc,
  createLayer,
  deserializeDoc,
  emptyPixels,
  flipPixels,
  getCel,
  MAX_FRAMES,
  MAX_LAYERS,
  type PixelDoc,
  serializeDoc,
  withCel,
} from './model';
import { CUSTOM_PALETTE_ID, DEFAULT_PALETTE_ID, PALETTES } from './palettes';

export type Tool = 'pencil' | 'eraser' | 'fill' | 'picker' | 'line' | 'rect' | 'ellipse' | 'hand';

export interface ArtworkMeta {
  /** id на сервері; null — ще не збережено */
  id: number | null;
  title: string;
  isPublic: boolean;
  dirty: boolean;
  savedAt: string | null;
}

const HISTORY_LIMIT = 100;
const RECENT_LIMIT = 12;

interface EditorState {
  doc: PixelDoc;
  frameIndex: number;
  layerId: string;

  tool: Tool;
  primary: string;
  secondary: string;
  recent: string[];
  paletteId: string;
  customPalette: string[];
  brushSize: number;
  mirrorX: boolean;
  shapeFilled: boolean;

  showGrid: boolean;
  onionSkin: boolean;
  playing: boolean;

  zoom: number;
  pan: { x: number; y: number };
  /** Збільшується, коли полотно треба «вписати» в екран */
  viewNonce: number;
  spaceDown: boolean;

  past: PixelDoc[];
  future: PixelDoc[];
  meta: ArtworkMeta;

  _strokeStart: PixelDoc | null;
  _lastKey: string | null;
  _lastAt: number;
}

interface EditorActions {
  newDocument: (width: number, height: number, layerName: string, title: string) => void;
  loadDocument: (input: { doc: PixelDoc; palette?: string[]; meta: Partial<ArtworkMeta> }) => void;

  beginStroke: () => void;
  setCel: (pixels: number[]) => void;
  endStroke: () => void;
  cancelStroke: () => void;
  undo: () => void;
  redo: () => void;

  addLayer: (name: string) => void;
  duplicateLayer: (suffix: string) => void;
  deleteLayer: (id: string) => void;
  moveLayer: (id: string, direction: 1 | -1) => void;
  selectLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  renameLayer: (id: string, name: string) => void;
  clearLayer: () => void;
  flipLayer: (axis: 'x' | 'y') => void;

  addFrame: () => void;
  duplicateFrame: () => void;
  deleteFrame: (index: number) => void;
  moveFrame: (from: number, to: number) => void;
  selectFrame: (index: number) => void;
  stepFrame: (delta: number) => void;
  setFps: (fps: number) => void;

  setTool: (tool: Tool) => void;
  setPrimary: (hex: string) => void;
  rememberColor: (hex: string) => void;
  setSecondary: (hex: string) => void;
  swapColors: () => void;
  setPaletteId: (id: string) => void;
  addToCustomPalette: (hex: string) => void;
  removeFromCustomPalette: (hex: string) => void;
  setBrushSize: (size: number) => void;
  toggleMirror: () => void;
  toggleShapeFilled: () => void;
  toggleGrid: () => void;
  toggleOnion: () => void;
  setPlaying: (playing: boolean) => void;

  setView: (zoom: number, pan: { x: number; y: number }) => void;
  fitView: () => void;
  setSpaceDown: (down: boolean) => void;

  setMeta: (meta: Partial<ArtworkMeta>) => void;
}

export type EditorStore = EditorState & EditorActions;

const DEFAULT_META: ArtworkMeta = {
  id: null,
  title: '',
  isPublic: false,
  dirty: false,
  savedAt: null,
};

function freshState(doc: PixelDoc): Pick<
  EditorState,
  'doc' | 'frameIndex' | 'layerId' | 'past' | 'future' | 'playing' | '_strokeStart' | '_lastKey'
> {
  return {
    doc,
    frameIndex: 0,
    layerId: doc.layers[doc.layers.length - 1].id,
    past: [],
    future: [],
    playing: false,
    _strokeStart: null,
    _lastKey: null,
  };
}

/** Після undo/redo вибраний шар чи кадр могли зникнути — повертаємо коректні значення. */
function fixSelection(doc: PixelDoc, frameIndex: number, layerId: string) {
  return {
    frameIndex: clamp(frameIndex, 0, doc.frames.length - 1),
    layerId: doc.layers.some((l) => l.id === layerId) ? layerId : doc.layers[doc.layers.length - 1].id,
  };
}

function pushRecent(recent: string[], hex: string) {
  return [hex, ...recent.filter((c) => c !== hex)].slice(0, RECENT_LIMIT);
}

const initialDoc = createDoc(32, 32, t('layers.defaultName', { n: 1 }));

export const useEditor = create<EditorStore>()((set, get) => {
  /** Записує новий документ в історію. key дозволяє «склеювати» серії дрібних змін (повзунок). */
  const commit = (next: PixelDoc, key?: string, extra: Partial<EditorState> = {}) =>
    set((s) => {
      const now = Date.now();
      const coalesce = key !== undefined && key === s._lastKey && now - s._lastAt < 800;
      return {
        doc: next,
        past: coalesce ? s.past : [...s.past, s.doc].slice(-HISTORY_LIMIT),
        future: [],
        _lastKey: key ?? null,
        _lastAt: now,
        meta: { ...s.meta, dirty: true },
        ...extra,
      };
    });

  return {
    ...freshState(initialDoc),
    tool: 'pencil',
    primary: '#1a1c2c',
    secondary: '#f4f4f4',
    recent: [],
    paletteId: DEFAULT_PALETTE_ID,
    customPalette: [],
    brushSize: 1,
    mirrorX: false,
    shapeFilled: false,
    showGrid: true,
    onionSkin: false,
    zoom: 16,
    pan: { x: 0, y: 0 },
    viewNonce: 0,
    spaceDown: false,
    meta: DEFAULT_META,
    _lastAt: 0,

    newDocument: (width, height, layerName, title) =>
      set((s) => ({
        ...freshState(createDoc(width, height, layerName)),
        meta: { ...DEFAULT_META, title },
        viewNonce: s.viewNonce + 1,
      })),

    loadDocument: ({ doc, palette, meta }) =>
      set((s) => {
        const extra: Partial<EditorState> = {};
        if (palette && palette.length > 0) {
          const preset = PALETTES.find((p) => p.colors.join() === palette.join());
          if (preset) extra.paletteId = preset.id;
          else {
            extra.paletteId = CUSTOM_PALETTE_ID;
            extra.customPalette = palette;
          }
        }
        return {
          ...freshState(doc),
          ...extra,
          meta: { ...DEFAULT_META, ...meta, dirty: meta.dirty ?? false },
          viewNonce: s.viewNonce + 1,
        };
      }),

    // ---------- Штрихи та історія ----------

    beginStroke: () => set({ _strokeStart: get().doc }),

    setCel: (pixels) => set((s) => ({ doc: withCel(s.doc, s.frameIndex, s.layerId, pixels) })),

    endStroke: () =>
      set((s) => {
        const start = s._strokeStart;
        if (!start) return {};
        if (start === s.doc) return { _strokeStart: null };
        return {
          _strokeStart: null,
          past: [...s.past, start].slice(-HISTORY_LIMIT),
          future: [],
          _lastKey: null,
          meta: { ...s.meta, dirty: true },
        };
      }),

    cancelStroke: () =>
      set((s) => (s._strokeStart ? { doc: s._strokeStart, _strokeStart: null } : {})),

    undo: () =>
      set((s) => {
        if (s.past.length === 0 || s._strokeStart) return {};
        const prev = s.past[s.past.length - 1];
        return {
          doc: prev,
          past: s.past.slice(0, -1),
          future: [s.doc, ...s.future].slice(0, HISTORY_LIMIT),
          _lastKey: null,
          meta: { ...s.meta, dirty: true },
          ...fixSelection(prev, s.frameIndex, s.layerId),
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0 || s._strokeStart) return {};
        const next = s.future[0];
        return {
          doc: next,
          past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
          _lastKey: null,
          meta: { ...s.meta, dirty: true },
          ...fixSelection(next, s.frameIndex, s.layerId),
        };
      }),

    // ---------- Шари ----------

    addLayer: (name) => {
      const { doc, layerId } = get();
      if (doc.layers.length >= MAX_LAYERS) return;
      const layer = createLayer(name);
      const index = doc.layers.findIndex((l) => l.id === layerId) + 1;
      const layers = [...doc.layers.slice(0, index), layer, ...doc.layers.slice(index)];
      const frames = doc.frames.map((f) => ({
        ...f,
        cels: { ...f.cels, [layer.id]: emptyPixels(doc.width, doc.height) },
      }));
      commit({ ...doc, layers, frames }, undefined, { layerId: layer.id });
    },

    duplicateLayer: (suffix) => {
      const { doc, layerId } = get();
      if (doc.layers.length >= MAX_LAYERS) return;
      const index = doc.layers.findIndex((l) => l.id === layerId);
      const source = doc.layers[index];
      const copy = { ...source, id: uid('layer'), name: `${source.name} ${suffix}` };
      const layers = [...doc.layers.slice(0, index + 1), copy, ...doc.layers.slice(index + 1)];
      const frames = doc.frames.map((f) => ({
        ...f,
        cels: { ...f.cels, [copy.id]: (f.cels[source.id] ?? emptyPixels(doc.width, doc.height)).slice() },
      }));
      commit({ ...doc, layers, frames }, undefined, { layerId: copy.id });
    },

    deleteLayer: (id) => {
      const { doc, layerId } = get();
      if (doc.layers.length <= 1) return;
      const index = doc.layers.findIndex((l) => l.id === id);
      const layers = doc.layers.filter((l) => l.id !== id);
      const frames = doc.frames.map((f) => {
        const cels = { ...f.cels };
        delete cels[id];
        return { ...f, cels };
      });
      const nextSelected = id === layerId ? layers[Math.max(0, index - 1)].id : layerId;
      commit({ ...doc, layers, frames }, undefined, { layerId: nextSelected });
    },

    moveLayer: (id, direction) => {
      const { doc } = get();
      const index = doc.layers.findIndex((l) => l.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= doc.layers.length) return;
      const layers = doc.layers.slice();
      [layers[index], layers[target]] = [layers[target], layers[index]];
      commit({ ...doc, layers });
    },

    selectLayer: (id) => set({ layerId: id }),

    toggleLayerVisibility: (id) => {
      const { doc } = get();
      commit({
        ...doc,
        layers: doc.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      });
    },

    setLayerOpacity: (id, opacity) => {
      const { doc } = get();
      commit(
        { ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, opacity: clamp(opacity, 0, 1) } : l)) },
        `opacity:${id}`,
      );
    },

    renameLayer: (id, name) => {
      const { doc } = get();
      const clean = name.trim().slice(0, 32);
      if (!clean) return;
      commit({ ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, name: clean } : l)) });
    },

    clearLayer: () => {
      const { doc, frameIndex, layerId } = get();
      commit(withCel(doc, frameIndex, layerId, emptyPixels(doc.width, doc.height)));
    },

    flipLayer: (axis) => {
      const { doc, frameIndex, layerId } = get();
      const cel = getCel(doc, frameIndex, layerId);
      commit(withCel(doc, frameIndex, layerId, flipPixels(cel, doc.width, doc.height, axis)));
    },

    // ---------- Кадри ----------

    addFrame: () => {
      const { doc, frameIndex } = get();
      if (doc.frames.length >= MAX_FRAMES) return;
      const frame = {
        id: uid('frame'),
        cels: Object.fromEntries(doc.layers.map((l) => [l.id, emptyPixels(doc.width, doc.height)])),
      };
      const frames = [...doc.frames.slice(0, frameIndex + 1), frame, ...doc.frames.slice(frameIndex + 1)];
      commit({ ...doc, frames }, undefined, { frameIndex: frameIndex + 1 });
    },

    duplicateFrame: () => {
      const { doc, frameIndex } = get();
      if (doc.frames.length >= MAX_FRAMES) return;
      const source = doc.frames[frameIndex];
      const frame = {
        id: uid('frame'),
        cels: Object.fromEntries(Object.entries(source.cels).map(([k, v]) => [k, v.slice()])),
      };
      const frames = [...doc.frames.slice(0, frameIndex + 1), frame, ...doc.frames.slice(frameIndex + 1)];
      commit({ ...doc, frames }, undefined, { frameIndex: frameIndex + 1 });
    },

    deleteFrame: (index) => {
      const { doc, frameIndex } = get();
      if (doc.frames.length <= 1) return;
      const frames = doc.frames.filter((_, i) => i !== index);
      const nextIndex = clamp(index <= frameIndex ? frameIndex - 1 : frameIndex, 0, frames.length - 1);
      commit({ ...doc, frames }, undefined, { frameIndex: nextIndex });
    },

    moveFrame: (from, to) => {
      const { doc } = get();
      if (from === to || to < 0 || to >= doc.frames.length) return;
      const frames = doc.frames.slice();
      const [moved] = frames.splice(from, 1);
      frames.splice(to, 0, moved);
      commit({ ...doc, frames }, undefined, { frameIndex: to });
    },

    selectFrame: (index) => set((s) => ({ frameIndex: clamp(index, 0, s.doc.frames.length - 1) })),

    stepFrame: (delta) =>
      set((s) => {
        const n = s.doc.frames.length;
        return { frameIndex: (((s.frameIndex + delta) % n) + n) % n };
      }),

    setFps: (fps) => {
      const { doc } = get();
      commit({ ...doc, fps: clamp(Math.round(fps), 1, 30) }, 'fps');
    },

    // ---------- Інструменти та кольори ----------

    setTool: (tool) => set({ tool }),
    setPrimary: (primary) => set({ primary }),
    setSecondary: (secondary) => set({ secondary }),
    rememberColor: (hex) =>
      set((s) => (s.recent[0] === hex ? {} : { recent: pushRecent(s.recent, hex) })),
    swapColors: () => set((s) => ({ primary: s.secondary, secondary: s.primary })),
    setPaletteId: (paletteId) => set({ paletteId }),
    addToCustomPalette: (hex) =>
      set((s) =>
        s.customPalette.includes(hex) || s.customPalette.length >= 64
          ? {}
          : { customPalette: [...s.customPalette, hex], paletteId: CUSTOM_PALETTE_ID },
      ),
    removeFromCustomPalette: (hex) =>
      set((s) => ({ customPalette: s.customPalette.filter((c) => c !== hex) })),
    setBrushSize: (size) => set({ brushSize: clamp(Math.round(size), 1, 8) }),
    toggleMirror: () => set((s) => ({ mirrorX: !s.mirrorX })),
    toggleShapeFilled: () => set((s) => ({ shapeFilled: !s.shapeFilled })),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleOnion: () => set((s) => ({ onionSkin: !s.onionSkin })),
    setPlaying: (playing) => set((s) => ({ playing: playing && s.doc.frames.length > 1 })),

    setView: (zoom, pan) => set({ zoom, pan }),
    fitView: () => set((s) => ({ viewNonce: s.viewNonce + 1 })),
    setSpaceDown: (spaceDown) => set({ spaceDown }),

    setMeta: (meta) => set((s) => ({ meta: { ...s.meta, ...meta } })),
  };
});

/** Поточні кольори палітри (вбудованої або власної). */
export function selectPaletteColors(s: EditorStore): string[] {
  if (s.paletteId === CUSTOM_PALETTE_ID) return s.customPalette;
  return PALETTES.find((p) => p.id === s.paletteId)?.colors ?? PALETTES[0].colors;
}

/** Координати курсора над полотном — окремий стор, щоб рух миші не перерендерював редактор. */
export const useCursor = create<{ pos: { x: number; y: number } | null }>()(() => ({ pos: null }));

// ---------- Автозбереження чернетки в localStorage ----------

const DRAFT_KEY = 'pixelforge:draft:v1';

type DraftFields = Pick<
  EditorState,
  | 'frameIndex'
  | 'layerId'
  | 'primary'
  | 'secondary'
  | 'recent'
  | 'paletteId'
  | 'customPalette'
  | 'brushSize'
  | 'mirrorX'
  | 'shapeFilled'
  | 'showGrid'
  | 'onionSkin'
  | 'meta'
  | 'tool'
>;

function restoreDraft(): void {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { doc: unknown } & Partial<DraftFields>;
    const { doc } = deserializeDoc(saved.doc);
    const { doc: _ignored, ...fields } = saved;
    void _ignored;
    useEditor.setState({
      ...fields,
      ...freshState(doc),
      ...fixSelection(doc, saved.frameIndex ?? 0, saved.layerId ?? ''),
      meta: { ...DEFAULT_META, ...saved.meta },
    });
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

// Відновлюємо чернетку одразу при завантаженні модуля — до першого рендеру
if (typeof localStorage !== 'undefined') restoreDraft();

export function startDraftAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = () => {
    const s = useEditor.getState();
    const payload = {
      doc: serializeDoc(s.doc),
      frameIndex: s.frameIndex,
      layerId: s.layerId,
      tool: s.tool,
      primary: s.primary,
      secondary: s.secondary,
      recent: s.recent,
      paletteId: s.paletteId,
      customPalette: s.customPalette,
      brushSize: s.brushSize,
      mirrorX: s.mirrorX,
      shapeFilled: s.shapeFilled,
      showGrid: s.showGrid,
      onionSkin: s.onionSkin,
      meta: s.meta,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // Сховище переповнене — не страшно, чернетка просто не оновиться
    }
  };

  const unsubscribe = useEditor.subscribe((state, prev) => {
    const relevant =
      state.doc !== prev.doc ||
      state.meta !== prev.meta ||
      state.primary !== prev.primary ||
      state.secondary !== prev.secondary ||
      state.paletteId !== prev.paletteId ||
      state.customPalette !== prev.customPalette ||
      state.layerId !== prev.layerId ||
      state.tool !== prev.tool ||
      state.showGrid !== prev.showGrid;
    if (!relevant || state._strokeStart) return;
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  });

  const flush = () => save();
  window.addEventListener('beforeunload', flush);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    window.removeEventListener('beforeunload', flush);
  };
}
