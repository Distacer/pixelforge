/**
 * Тонка обгортка над fetch: додає JWT, розбирає помилки FastAPI, типізує відповіді.
 * У dev-режимі Vite проксіює /api на localhost:8000, у Docker це робить nginx,
 * тому базова адреса за замовчуванням порожня (той самий домен).
 */

import { useAuth } from '../../store/auth';
import type {
  Artwork,
  ArtworkCreate,
  ArtworkDetail,
  ArtworkUpdate,
  LikeState,
  Page,
  PublicProfile,
  SortMode,
  TokenResponse,
  User,
} from './types';

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  raw?: boolean;
}

/** FastAPI повертає detail рядком або масивом помилок валідації. */
function readDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : ''))
      .filter(Boolean)
      .join('; ');
  }
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, signal, raw } = options;
  const headers: Record<string, string> = {};
  const token = useAuth.getState().token;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'network');
  }

  if (response.status === 401 && token) useAuth.getState().logout();

  if (!response.ok) {
    let message = response.statusText || `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = readDetail(data?.detail, message);
    } catch {
      /* відповідь без JSON */
    }
    throw new ApiError(response.status, message);
  }

  if (raw) return (await response.blob()) as T;
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export interface ListParams {
  sort?: SortMode;
  q?: string;
  limit?: number;
  offset?: number;
}

export const api = {
  auth: {
    register: (username: string, password: string) =>
      request<TokenResponse>('/api/auth/register', { method: 'POST', body: { username, password } }),
    login: (username: string, password: string) =>
      request<TokenResponse>('/api/auth/login', { method: 'POST', body: { username, password } }),
    checkUsername: (username: string, signal?: AbortSignal) =>
      request<{ username: string; available: boolean }>(
        `/api/auth/check-username${query({ username })}`,
        { signal },
      ),
  },
  users: {
    me: () => request<User>('/api/users/me'),
    deleteMe: () => request<void>('/api/users/me', { method: 'DELETE' }),
    profile: (username: string) => request<PublicProfile>(`/api/users/${encodeURIComponent(username)}`),
    artworks: (username: string, params: ListParams = {}) =>
      request<Page<Artwork>>(
        `/api/users/${encodeURIComponent(username)}/artworks${query({ ...params })}`,
      ),
  },
  artworks: {
    mine: (params: ListParams = {}) => request<Page<Artwork>>(`/api/artworks/mine${query({ ...params })}`),
    get: (id: number) => request<ArtworkDetail>(`/api/artworks/${id}`),
    create: (body: ArtworkCreate) => request<ArtworkDetail>('/api/artworks', { method: 'POST', body }),
    update: (id: number, body: ArtworkUpdate) =>
      request<ArtworkDetail>(`/api/artworks/${id}`, { method: 'PATCH', body }),
    remove: (id: number) => request<void>(`/api/artworks/${id}`, { method: 'DELETE' }),
    duplicate: (id: number, title?: string) =>
      request<ArtworkDetail>(`/api/artworks/${id}/duplicate`, {
        method: 'POST',
        body: title ? { title } : undefined,
      }),
    upload: (file: File, title: string, isPublic: boolean) => {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title);
      form.append('is_public', String(isPublic));
      return request<Artwork>('/api/artworks/upload', { method: 'POST', form });
    },
    like: (id: number) => request<LikeState>(`/api/artworks/${id}/like`, { method: 'POST' }),
    unlike: (id: number) => request<LikeState>(`/api/artworks/${id}/like`, { method: 'DELETE' }),
    previewBlob: (artwork: Pick<Artwork, 'preview_url'>) =>
      request<Blob>(artwork.preview_url, { raw: true }),
  },
  gallery: {
    list: (params: ListParams = {}) => request<Page<Artwork>>(`/api/gallery${query({ ...params })}`),
  },
};
