import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useToasts } from '../../store/toasts';
import { cn } from '../lib/misc';

const ICONS = { success: CheckCircle2, error: TriangleAlert, info: Info };

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-px border-2 border-[rgb(var(--shadow))] bg-surface px-4 py-2.5 text-sm shadow-pixel"
            >
              <Icon
                size={18}
                className={cn(
                  'shrink-0',
                  toast.kind === 'success' && 'text-teal',
                  toast.kind === 'error' && 'text-danger',
                  toast.kind === 'info' && 'text-muted',
                )}
              />
              <span className="flex-1">{toast.message}</span>
              <button type="button" className="-mr-1 text-muted hover:text-ink" onClick={() => dismiss(toast.id)}>
                <X size={16} />
                <span className="sr-only">OK</span>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
