import { Activity, ArrowRight, Server, TerminalSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCopy } from '../i18n';
import type { Language, NormalizedTaskStatus, SutTarget } from '../types';
import { StatusBadge } from './StatusBadge';

export function ExecutionFocus({
  language,
  sut,
  task
}: {
  language: Language;
  sut: SutTarget;
  task: NormalizedTaskStatus;
}) {
  const t = getCopy(language);
  const total = task.progress?.total_commands ?? task.result?.total_commands ?? 0;
  const completed = task.progress?.completed ?? task.result?.success_count ?? 0;

  return (
    <section className="execution-focus" aria-labelledby="execution-focus-title">
      <h2 id="execution-focus-title" className="sr-only">
        {t.executionFocus}
      </h2>
      <div className="focus-main">
        <span className="focus-label">{t.activeRun}</span>
        <strong className="focus-task-id">{task.task_id}</strong>
      </div>
      <div className="focus-meta">
        <span>
          <Server aria-hidden="true" />
          {sut.name} · {sut.version}
        </span>
        <StatusBadge status={task.uiStatus} language={language} />
      </div>
      <div className="focus-progress" aria-label={t.progress}>
        <Activity aria-hidden="true" />
        <strong>
          {completed}/{total}
        </strong>
        <span>{t.progress}</span>
      </div>
      <div className="focus-command">
        <TerminalSquare aria-hidden="true" />
        <code>{task.progress?.current_command ?? t.noFakeLiveLogs}</code>
      </div>
      <Link className="focus-link" to="/observation">
        {t.openObservation}
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}
