import { Download } from 'lucide-react';
import { getCopy } from '../i18n';
import type { Language, NormalizedTaskStatus } from '../types';

export function LogExportAction({
  task,
  language
}: {
  task: NormalizedTaskStatus;
  language: Language;
}) {
  const t = getCopy(language);
  const canExport = task.canExportLogs && Boolean(task.logDownloadUrl);

  return (
    <a
      className={`button button--secondary log-export-action ${canExport ? '' : 'button--disabled'}`.trim()}
      href={canExport ? task.logDownloadUrl : '#'}
      download
      aria-disabled={canExport ? undefined : 'true'}
      onClick={(event) => {
        if (!canExport) {
          event.preventDefault();
        }
      }}
    >
      <Download aria-hidden="true" />
      {t.exportLogs}
    </a>
  );
}
