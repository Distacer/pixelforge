import { useT } from '../../shared/i18n';
import { EmptyState, Spinner } from '../../shared/ui/controls';

export function ListFooter({
  loading,
  hasMore,
  onMore,
}: {
  loading: boolean;
  hasMore: boolean;
  onMore: () => void;
}) {
  const t = useT();
  if (!hasMore) return null;
  return (
    <div className="mt-10 flex justify-center">
      <button type="button" className="btn-secondary" onClick={onMore} disabled={loading}>
        {loading && <Spinner size={16} />}
        {t('gallery.more')}
      </button>
    </div>
  );
}

export function ListError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <EmptyState
      title={t('error.loadTitle')}
      description={t('error.loadHint')}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t('common.retry')}
        </button>
      }
    />
  );
}
