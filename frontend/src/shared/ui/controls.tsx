/** Дрібні контроли: іконкова кнопка з підказкою, перемикач, сегменти, спінер. */

import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/misc';

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  tooltipSide?: 'right' | 'bottom' | 'top' | 'left';
  className?: string;
  size?: number;
}

const TOOLTIP_SIDE = {
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
};

export function IconButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  pressed,
  disabled,
  tooltipSide = 'bottom',
  className,
  size = 18,
}: IconButtonProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className={cn('icon-btn', className)}
        onClick={onClick}
        disabled={disabled}
        aria-label={shortcut ? `${label} (${shortcut})` : label}
        aria-pressed={pressed === undefined ? undefined : pressed}
      >
        <Icon size={size} strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-px bg-[rgb(var(--shadow))] px-2 py-1 text-xs text-white opacity-0 transition-opacity delay-300 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100',
          TOOLTIP_SIDE[tooltipSide],
        )}
      >
        {label}
        {shortcut && <kbd className="ml-1.5 font-sans text-white/60">{shortcut}</kbd>}
      </span>
    </span>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-px border-2 transition-colors',
          checked ? 'border-[rgb(var(--shadow))] bg-teal' : 'border-line bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-[1px] bg-white shadow-sm transition-[left] duration-150',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-muted">{description}</span>}
      </span>
    </label>
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  label: string;
  className?: string;
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-px border-2 border-line bg-surface-2 p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[2px] px-3 py-1 text-sm transition-colors',
              active ? 'bg-surface font-semibold text-ink shadow-pixel-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} aria-hidden />;
}

export function EmptyState({
  title,
  description,
  action,
  art,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-px border-2 border-dashed border-line px-6 py-14 text-center">
      {art}
      <h3 className="font-pixel text-lg">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
