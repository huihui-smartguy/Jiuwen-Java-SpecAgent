import type { Language, SutHealth, UiTaskStatus } from '../types';
import { getCopy } from '../i18n';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const statusTone: Record<SutHealth | UiTaskStatus, BadgeTone> = {
  healthy: 'success',
  degraded: 'warning',
  offline: 'danger',
  pending: 'warning',
  running: 'info',
  success: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  polling_error: 'danger'
};

export function StatusBadge({
  status,
  language,
  label
}: {
  status: SutHealth | UiTaskStatus;
  language: Language;
  label?: string;
}) {
  const t = getCopy(language);
  const text = label ?? t[status as keyof typeof t] ?? status;

  return <span className={`status-badge status-badge--${statusTone[status]}`}>{text}</span>;
}
