import { Flag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCopy } from '../i18n';
import { objectNameLabel } from '../objectLabels';
import type { Language, NormalizedTaskStatus, SutTarget } from '../types';

export function ExecutionFocus({
  language,
  sut,
  task
}: {
  language: Language;
  sut: SutTarget;
  task: NormalizedTaskStatus | null;
}) {
  const t = getCopy(language);
  const total = task?.progress?.total_commands ?? task?.result?.total_commands ?? 0;
  const completed = task?.progress
    ? task.progress.completed
    : (task?.result?.success_count ?? 0) + (task?.result?.failed_count ?? 0);
  const boundedCompleted = Math.min(Math.max(completed, 0), Math.max(total, 0));
  const percent = total > 0 ? Math.min(100, Math.max(0, (boundedCompleted / total) * 100)) : 0;
  const rawCommand = task?.progress?.current_command;
  const currentCommand = rawCommand
    ? rawCommand.replace(/^(?:执行命令|command)\s*[:：]\s*/iu, '')
    : t.noCurrentCommand;
  const statusLabel = !task
    ? t.notAvailable
    : task.uiStatus === 'polling_error'
    ? t.polling_error
    : (task.backend_status ?? task.status).toUpperCase();

  return (
    <section className="execution-focus overview-current-run" aria-labelledby="current-run-title">
      <h2 id="current-run-title" className="sr-only">
        {t.activeRun}
      </h2>
      <div className="current-run__identity">
        <span className="current-run__icon" aria-hidden="true">
          <Flag />
        </span>
        <div>
          <span className="current-run__label">{t.activeRun} · {statusLabel}</span>
          <strong className="focus-task-id">{task?.task_id ?? t.noActiveTask}</strong>
          <span className="sr-only">{objectNameLabel(sut)} · {sut.version}</span>
        </div>
      </div>
      <div className="current-run__progress">
        <span className="current-run__label">
          {t.progress} · <strong>{boundedCompleted} / {total}</strong>
        </span>
        <div
          className="current-run__progress-track"
          role="progressbar"
          aria-label={t.progress}
          aria-valuemin={0}
          aria-valuemax={Math.max(total, 1)}
          aria-valuenow={boundedCompleted}
          aria-valuetext={!task ? t.noActiveTask : undefined}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="current-run__command">
        <span className="current-run__label">{t.currentCommand}</span>
        <code>{currentCommand}</code>
      </div>
      {task ? (
        <Link className="focus-link" to="/observation">
          {t.openObserveConsole}
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className="focus-link" aria-disabled="true">
          {t.openObserveConsole}
          <span aria-hidden="true">→</span>
        </span>
      )}
    </section>
  );
}
