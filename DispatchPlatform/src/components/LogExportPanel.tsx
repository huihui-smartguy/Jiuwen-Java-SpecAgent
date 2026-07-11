import { Download, ShieldCheck } from 'lucide-react';
import type { Language, NormalizedTaskStatus } from '../types';
import { getCopy } from '../i18n';

export function LogExportPanel({
  task,
  language
}: {
  task: NormalizedTaskStatus;
  language: Language;
}) {
  const t = getCopy(language);
  const href = task.canExportLogs ? task.logDownloadUrl : '#';

  return (
    <section className="panel log-export-panel" aria-labelledby="log-export-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t.terminalOnly}</p>
          <h2 id="log-export-title">{t.exportLogs}</h2>
        </div>
        <ShieldCheck aria-hidden="true" className="panel-icon" />
      </div>

      <a
        className={`button button--primary ${task.canExportLogs ? '' : 'button--disabled'}`}
        href={href}
        aria-disabled={task.canExportLogs ? undefined : 'true'}
        onClick={(event) => {
          if (!task.canExportLogs) {
            event.preventDefault();
          }
        }}
      >
        <Download aria-hidden="true" />
        {t.exportLogs}
      </a>
      {!task.canExportLogs && <p className="helper-text">{t.exportLogsUnavailable}</p>}
      {task.logs?.file_path && <p className="mono-note">{task.logs.file_path}</p>}
    </section>
  );
}
