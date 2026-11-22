import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/misc';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface MenuProps {
  /** Рендер кнопки-тригера; отримує пропси, які треба прокинути на <button> */
  trigger: (props: {
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => ReactNode;
  items: Array<MenuItem | 'divider'>;
  align?: 'start' | 'end';
  className?: string;
}

/** Випадне меню з керуванням з клавіатури (↑ ↓ Home End Esc). */
export function Menu({ trigger, items, align = 'end', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus());
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      (rootRef.current?.querySelector('button') as HTMLElement | null)?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      nodes[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      nodes[nodes.length - 1]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      {trigger({
        onClick: () => setOpen((v) => !v),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            id={id}
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'absolute top-full z-40 mt-1.5 min-w-52 rounded-px border-2 border-[rgb(var(--shadow))] bg-surface p-1 shadow-pixel',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((item, i) =>
              item === 'divider' ? (
                <div key={`d${i}`} className="my-1 h-px bg-line" role="separator" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-px px-2.5 py-2 text-left text-sm outline-none hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-40',
                    item.danger ? 'text-danger' : 'text-ink',
                  )}
                >
                  {item.icon && <item.icon size={16} className="shrink-0 opacity-80" />}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && <kbd className="text-xs text-muted">{item.hint}</kbd>}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
