/** Типи відповідей API — дзеркало Pydantic-схем із backend/app/schemas.py */

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface PublicProfile {
  username: string;
  created_at: string;
  public_artworks: number;
  total_likes: number;
}

export type ArtworkKind = 'pixel' | 'image';
export type SortMode = 'new' | 'popular' | 'updated';

export interface Artwork {
  id: number;
  title: string;
  kind: ArtworkKind;
  width: number;
  height: number;
  frame_count: number;
  is_public: boolean;
  owner: string;
  like_count: number;
  liked_by_me: boolean;
  preview_url: string;
  created_at: string;
  updated_at: string;
}

export interface ArtworkDetail extends Artwork {
  data: unknown | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LikeState {
  like_count: number;
  liked_by_me: boolean;
}

export interface ArtworkCreate {
  title: string;
  width: number;
  height: number;
  frame_count: number;
  data: unknown;
  preview_png: string;
  is_public: boolean;
}

export type ArtworkUpdate = Partial<ArtworkCreate>;
