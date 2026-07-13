import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, CircleDot, CircleX, Clock3, FileTerminal, TimerReset } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, cancelTask, getTaskStatus, normalizeTaskStatus } from '../api/client';
import { LogExportPanel } from '../components/LogExportPanel';
import { LiveLogConsole } from '../components/LiveLogConsole';
import { StatusBadge } from '../components/StatusBadge';
import { getCopy } from '../i18n';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  runtimeConfig: RuntimeConfig;
  onTaskStatusChange: (task: NormalizedTaskStatus) => void;
}

function isPollingTask(task: NormalizedTaskStatus) {
  return task.status === 'pending' || task.status === 'running';
}

function asPollingError(task: NormalizedTaskStatus): NormalizedTaskStatus {
  return {
    ...task,
    uiStatus: 'polling_error',
    isTerminal: false,
    canExportLogs: false,
    logDownloadUrl: undefined
  };
}

export function Observation({
  language,
  selectedSut,
  activeTask,
  runtimeConfig,
  onTaskStatusChange
}: PageProps) {
  const t = getCopy(language);
  const [cancellationRequestedTaskId, setCancellationRequestedTaskId] = useState<string>();
  const api = useMemo(
    () => ({ apiBaseUrl: selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl }),
    [runtimeConfig.apiBaseUrl, selectedSut.apiBaseUrl]
  );
  const taskQuery = useQuery({
    queryKey: ['task-status', api.apiBaseUrl, activeTask.task_id],
    queryFn: async () => {
      try {
        return normalizeTaskStatus(await getTaskStatus(api, activeTask.task_id, activeTask.trigger_type));
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return activeTask;
        }
        throw error;
      }
    },
    refetchInterval: (query) => {
      const latestTask = query.state.data ?? activeTask;
      return isPollingTask(latestTask) ? 5000 : false;
    },
    refetchIntervalInBackground: true
  });
  const cancellation = useMutation({
    mutationFn: (taskId: string) => cancelTask(api, taskId),
    onSuccess: (_response, taskId) => {
      setCancellationRequestedTaskId(taskId);
      void taskQuery.refetch();
    }
  });
  const task = taskQuery.isError ? asPollingError(activeTask) : taskQuery.data ?? activeTask;
  const progress = task.progress;
  const completedCommands = progress?.completed ?? task.result?.success_count ?? 0;
  const totalCommands = progress?.total_commands ?? task.result?.total_commands ?? 0;
  const failedCommands = progress?.failed ?? task.result?.failed_count ?? 0;
  const terminalStage = task.status === 'failed' || task.status === 'cancelled' ? task.status : 'success';
  const terminalHasError = task.status === 'failed' || task.status === 'cancelled';
  const cancellationAcknowledged = cancellationRequestedTaskId === task.task_id;
  const cancellationPending = cancellation.isPending && cancellation.variables === task.task_id;
  const cancellationFailed = cancellation.isError && cancellation.variables === task.task_id;
  const canRequestCancellation = isPollingTask(task) && !cancellationAcknowledged;
  const cancellationError = cancellation.error instanceof ApiError
    ? cancellation.error.message
    : t.cancellationFailed;
  const currentStage = task.status === 'pending' ? 0 : task.status === 'running' ? 1 : 2;
  const stages = [
    { key: 'pending', label: t.pending },
    { key: 'running', label: t.running },
    { key: terminalStage, label: t[terminalStage] }
  ];

  useEffect(() => {
    if (taskQuery.data) {
      onTaskStatusChange(taskQuery.data);
    }
  }, [onTaskStatusChange, taskQuery.data]);

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">
            {selectedSut.name} · {selectedSut.version}
          </p>
          <h1>{t.observation}</h1>
          <p className="page-subtitle">{t.observationSubtitle}</p>
        </div>
        <div className="observation-title-status">
          <span>{t.pollingEveryFiveSeconds}</span>
          {task.backend_status === 'queued' && (task.queue_position ?? -1) > 0 && (
            <span className="queue-position" aria-live="polite">
              {t.queuePosition}: {task.queue_position}
            </span>
          )}
          <StatusBadge status={task.uiStatus} language={language} />
          {canRequestCancellation && (
            <button
              type="button"
              className="button button--danger observation-cancel"
              onClick={() => cancellation.mutate(task.task_id)}
              disabled={cancellationPending}
            >
              <CircleX aria-hidden="true" />
              {cancellationPending ? t.requestingCancellation : t.requestCancellation}
            </button>
          )}
          {isPollingTask(task) && cancellationAcknowledged && (
            <span className="cancellation-status" role="status">
              {t.cancellationRequested}
            </span>
          )}
        </div>
      </div>

      <section className="observation-workbench" aria-label={t.observation}>
        <aside className="panel observation-stages" aria-labelledby="stage-timeline-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t.progress}</p>
              <h2 id="stage-timeline-title">{t.stageTimeline}</h2>
            </div>
            <Clock3 aria-hidden="true" className="panel-icon" />
          </div>
          <ol className="stage-list">
            {stages.map((stage, index) => {
              const state = index < currentStage ? 'complete' : index === currentStage ? 'current' : 'upcoming';
              return (
                <li className={`stage-list__item ${state}`} key={stage.key}>
                  <span className="stage-list__marker" aria-hidden="true">
                    {state === 'complete' ? <Check /> : <CircleDot />}
                  </span>
                  <div>
                    <strong>{stage.label}</strong>
                    <span>{index === 0 ? t.taskQueued : index === 1 ? t.executionInProgress : t.terminalState}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="stage-task-id">
            <span>{t.taskReference}</span>
            <code>{task.task_id}</code>
          </div>
          </aside>

        <section className="panel observation-details" aria-labelledby="execution-details-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t.activeRun}</p>
              <h2 id="execution-details-title">{t.executionDetails}</h2>
            </div>
            {taskQuery.isFetching && <span className="polling-indicator"><TimerReset aria-hidden="true" /> {t.polling}</span>}
          </div>

          <dl className="observation-metrics">
            <div>
              <dt>{t.progress}</dt>
              <dd>{completedCommands}/{totalCommands}</dd>
            </div>
            <div>
              <dt>{t.failedCommands}</dt>
              <dd>{failedCommands}</dd>
            </div>
            <div>
              <dt>{t.elapsedTime}</dt>
              <dd>{task.elapsed_time ?? t.notAvailable}</dd>
            </div>
            <div>
              <dt>{t.estimatedRemaining}</dt>
              <dd>{task.estimated_remaining ?? t.notAvailable}</dd>
            </div>
          </dl>

          <div className="observation-command" aria-label={t.currentCommand}>
            <FileTerminal aria-hidden="true" />
            <div>
              <span>{t.currentCommand}</span>
              <code>{progress?.current_command ?? t.noCurrentCommand}</code>
            </div>
          </div>

          {task.result && (
            <div className={`observation-result ${terminalHasError ? 'has-error' : ''}`}>
              {terminalHasError ? <AlertTriangle aria-hidden="true" /> : <Check aria-hidden="true" />}
              <div>
                <strong>{task.status === 'failed' ? t.failed : task.status === 'cancelled' ? t.cancelled : t.success}</strong>
                {task.result.error_message && <span>{task.result.error_message}</span>}
              </div>
            </div>
          )}
          {taskQuery.isError && <p className="polling-error">{t.pollingErrorHint}</p>}
          {cancellationFailed && <p className="polling-error">{cancellationError}</p>}
        </section>

        <LogExportPanel task={task} language={language} />
        <LiveLogConsole language={language} api={api} task={task} />
      </section>
    </div>
  );
}
