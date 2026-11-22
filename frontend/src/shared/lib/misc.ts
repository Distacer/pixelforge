/** Дрібні утиліти, що потрібні всюди. */

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Офіційна транслітерація (постанова КМУ №55, 2010) — спрощена, без особливих правил для початку слова
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i',
  ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '',
};

/**
 * Назва роботи → безпечне ім'я файлу латиницею.
 * Деякі браузери ігнорують атрибут download з не-ASCII символами й зберігають файл як «download».
 */
export function safeFilename(title: string, fallback = 'pixelforge'): string {
  const latin = [...title.trim()]
    .map((ch) => {
      const lower = ch.toLowerCase();
      if (!(lower in TRANSLIT)) return ch;
      const out = TRANSLIT[lower];
      return ch === lower ? out : out.charAt(0).toUpperCase() + out.slice(1);
    })
    .join('');
  const clean = latin
    .replace(/[^\w\s.-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return clean || fallback;
}

export function formatDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
