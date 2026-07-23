import { RefreshCw } from 'lucide-react';
import { useOptionalCatalog } from '../catalog/CatalogProvider';
import type { Language } from '../types';

const copy = {
  zh: {
    connecting: '正在连接实时目录',
    live: '实时',
    polling: '轮询兜底',
    stale: '目录已过期',
    unavailable: '目录不可用',
    mock: '演示目录',
    checked: '检查于',
    refresh: '刷新目录',
    retry: '重试目录'
  },
  en: {
    connecting: 'Connecting to live catalog',
    live: 'Live',
    polling: 'Polling fallback',
    stale: 'Catalog is stale',
    unavailable: 'Catalog unavailable',
    mock: 'Demo catalog',
    checked: 'Checked',
    refresh: 'Refresh catalog',
    retry: 'Retry catalog'
  }
} as const;

function checkedTime(value: string | undefined, language: Language): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(date);
}

export function CatalogSyncStatus({
  language,
  className = ''
}: {
  language: Language;
  className?: string;
}) {
  const catalog = useOptionalCatalog();
  if (!catalog) {
    return null;
  }
  const t = copy[language];
  const time = checkedTime(catalog.checkedAt, language);
  const stateLabel = t[catalog.state];
  const actionLabel = catalog.state === 'stale' || catalog.state === 'unavailable'
    ? t.retry
    : t.refresh;

  return (
    <div className={`catalog-sync catalog-sync--${catalog.state} ${className}`.trim()}>
      <span className="catalog-sync__summary">
        <span
          className="catalog-sync__status"
          role="status"
          aria-live="polite"
          data-testid="catalog-sync-state"
        >
          <span className="catalog-sync__dot" aria-hidden="true" />
          <strong>{stateLabel}</strong>
        </span>
        {time ? (
          <small className="catalog-sync__checked">{t.checked} {time}</small>
        ) : null}
      </span>
      <button
        type="button"
        aria-label={actionLabel}
        title={actionLabel}
        disabled={catalog.isFetching}
        onClick={() => { void catalog.refresh().catch(() => undefined); }}
      >
        <RefreshCw aria-hidden="true" className={catalog.isFetching ? 'is-spinning' : undefined} />
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}
