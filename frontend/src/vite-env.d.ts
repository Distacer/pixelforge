/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адреса бекенду, якщо він на іншому домені. За замовчуванням — той самий домен (/api). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
