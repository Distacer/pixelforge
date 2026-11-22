import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../shared/api/types';

interface AuthState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

/** JWT і профіль зберігаються в localStorage, тож вхід «переживає» перезавантаження. */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'pixelforge:auth' },
  ),
);
