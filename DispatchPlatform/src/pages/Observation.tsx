import { useMutation, useQuery } from '@tanstack/react-query';
import { Box, CircleDot, CircleX, Clock3, Command } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, cancelTask, getTaskStatus, normalizeTaskStatus } from '../api/client';
import { LiveLogConsole } from '../components/LiveLogConsole';
import { LogExportAction } from '../components/LogExportAction';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { mockObservationEvents } from '../data/mockData';
import { getCopy } from '../i18n';
import type {
  Language,
  NormalizedTaskStatus,
  RuntimeConfig,
  SutTarget,
  UiTaskStatus
} from '../types';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  runtimeConfig: RuntimeConfig;
  onTaskStatusChange: (task: NormalizedTaskStatus) => void;
}

type StageState = 'complete' | 'current' | 'error' | 'upcoming' | 'neutral';

interface TaskStatusQueryResult {
  task: NormalizedTaskStatus;
  source: 'live' | 'fallback';
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

function stageStateFor(
  task: NormalizedTaskStatus,
  completedCommands: number,
  index: number,
  stageCount: number
): StageState {
  if (task.status === 'success') {
    return 'complete';
  }
  if (task.status === 'pending') {
    return index === 0 ? 'current' : 'upcoming';
  }
  if (task.status === 'running') {
    const currentIndex = Math.min(Math.max(completedCommands, 0), stageCount - 1);
    return index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
  }
  if (task.status === 'failed' || task.status === 'cancelled') {
    const errorIndex = Math.min(Math.max(completedCommands, 0), stageCount - 1);
    return index < errorIndex ? 'complete' : index === errorIndex ? 'error' : 'upcoming';
  }
  return 'neutral';
}

function stripCommandPrefix(command: string | undefined, fallback: string) {
  return command?.replace(/^(?:执行命令|running command)\s*:\s*/iu, '') || fallback;
}

function compactTaskId(taskId: string) {
  return taskId.length > 6 ? `…${taskId.slice(-6)}` : taskId;
}

function displayTime(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  return value.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? value;
}

function isKnownUiStatus(status: string): status is UiTaskStatus {
  return status === 'pending'
    || status === 'running'
    || status === 'success'
    || status === 'failed'
    || status === 'cancelled'
    || status === 'polling_error';
}

function ObservationMetric({
  label,
  value,
  detail,
  icon
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ReactNode;
}) {
  return (
    <article className="observation-metric-card" aria-label={label}>
      <header>
        <h2>{label}</h2>
        {icon}
      </header>
      <strong className="observation-metric-card__value">{value}</strong>
      <p>{detail}</p>
    </article>
  );
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
  const taskQuery = useQuery<TaskStatusQueryResult>({
    queryKey: ['task-status', api.apiBaseUrl, activeTask.task_id],
    queryFn: async () => {
      try {
        const task = normalizeTaskStatus(
          await getTaskStatus(api, activeTask.task_id, activeTask.trigger_type)
        );
        return { task, source: 'live' };
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return { task: activeTask, source: 'fallback' };
        }
        throw error;
      }
    },
    refetchInterval: (query) => {
      const latestTask = query.state.data?.task ?? activeTask;
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
  const task = taskQuery.isError ? asPollingError(activeTask) : taskQuery.data?.task ?? activeTask;
  const progress = task.progress;
  const completedCommands = progress?.completed ?? task.result?.success_count ?? 0;
  const totalCommands = progress?.total_commands ?? task.result?.total_commands ?? 0;
  const currentCommand = stripCommandPrefix(progress?.current_command, t.noCurrentCommand);
  const cancellationAcknowledged = cancellationRequestedTaskId === task.task_id;
  const cancellationPending = cancellation.isPending && cancellation.variables === task.task_id;
  const cancellationFailed = cancellation.isError && cancellation.variables === task.task_id;
  const canRequestCancellation = isPollingTask(task) && !cancellationAcknowledged;
  const cancellationError = cancellation.error instanceof ApiError
    ? cancellation.error.message
    : t.cancellationFailed;
  const statusLabel = isKnownUiStatus(String(task.uiStatus))
    ? t[task.uiStatus]
    : String(task.uiStatus);
  const badgeStatus = isKnownUiStatus(String(task.uiStatus)) ? task.uiStatus : 'cancelled';
  const stageLabels = [
    t.environmentCheck,
    t.scriptPreparation,
    t.saveApi,
    t.queryApi,
    t.summary
  ];
  const connectionLabel = taskQuery.isFetching
    ? t.polling
    : taskQuery.isError
      ? t.statusUnavailable
      : taskQuery.data?.source === 'fallback'
        ? t.mockMode
        : taskQuery.data?.source === 'live'
          ? t.connected
          : t.polling;
  const connectionTone = taskQuery.isFetching
    ? 'is-pending'
    : taskQuery.isError
      ? 'is-unavailable'
      : taskQuery.data?.source === 'fallback'
        ? 'is-fallback'
        : taskQuery.data?.source === 'live'
          ? 'is-connected'
          : 'is-pending';

  useEffect(() => {
    if (taskQuery.data) {
      onTaskStatusChange(taskQuery.data.task);
    }
  }, [onTaskStatusChange, taskQuery.data]);

  return (
    <div className="page-stack observation-page">
      <PageHeader
        title={t.observation}
        subtitle={t.observationSubtitle}
        action={(
          <div className="observation-header-actions">
            <StatusBadge status={badgeStatus} language={language} label={statusLabel} />
            <LogExportAction task={task} language={language} />
          </div>
        )}
      />

      <section className="observation-metrics" aria-label={t.observationMetrics}>
        <ObservationMetric
          label={t.taskStatus}
          value={statusLabel}
          detail={task.backend_status === 'queued' && (task.queue_position ?? -1) > 0
            ? `${t.queuePosition}: ${task.queue_position}`
            : task.task_id}
          icon={<CircleDot aria-hidden="true" />}
        />
        <ObservationMetric
          label={t.commandProgress}
          value={`${completedCommands} / ${totalCommands}`}
          detail={`${t.current}: ${currentCommand}`}
          icon={<Command aria-hidden="true" />}
        />
        <ObservationMetric
          label={t.elapsedTime}
          value={task.elapsed_time ?? t.notAvailable}
          detail={`${t.estimatedRemaining}: ${task.estimated_remaining ?? t.notAvailable}`}
          icon={<Clock3 aria-hidden="true" />}
        />
        <ObservationMetric
          label="Object"
          value={selectedSut.name}
          detail={`${selectedSut.version} · ${t[selectedSut.status]}`}
          icon={<Box aria-hidden="true" />}
        />
      </section>

      <section className="observation-path-card" aria-labelledby="observation-path-title">
        <header className="observation-path-card__heading">
          <div>
            <h2 id="observation-path-title">{t.executionPath}</h2>
            <p>{t.statusRefreshEveryFiveSeconds}</p>
          </div>
          <span>{t.autoRefreshEnabled}</span>
        </header>
        <ol className="observation-path-list">
          {stageLabels.map((label, index) => {
            const state = stageStateFor(task, completedCommands, index, stageLabels.length);
            const detail = state === 'complete'
              ? t.stageComplete
              : state === 'current'
                ? index === 0 && task.status === 'pending' ? t.taskQueued : currentCommand
                : state === 'error'
                  ? statusLabel
                  : state === 'upcoming'
                    ? t.stagePending
                    : t.notAvailable;
            return (
              <li key={label} data-stage-state={state}>
                <span className="observation-path-list__track" aria-hidden="true" />
                <strong>{label}</strong>
                <small>{detail}</small>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="observation-lower-grid" data-testid="observation-lower-grid">
        <LiveLogConsole
          language={language}
          api={api}
          task={task}
          mockEntries={runtimeConfig.enableMockFallback ? mockObservationEvents : undefined}
        />

        <section className="observation-control-card" aria-labelledby="task-control-title">
          <header>
            <h2 id="task-control-title">{t.taskControl}</h2>
            <span
              className={`observation-connection ${connectionTone}`}
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true" />
              {connectionLabel}
            </span>
          </header>

          <dl className="observation-task-metadata">
            <div>
              <dt>{t.taskId}</dt>
              <dd title={task.task_id}>{compactTaskId(task.task_id)}</dd>
            </div>
            <div>
              <dt>{t.createdBy}</dt>
              <dd>{t.notAvailable}</dd>
            </div>
            <div>
              <dt>{t.started}</dt>
              <dd>{displayTime(task.started_at, t.notAvailable)}</dd>
            </div>
            <div>
              <dt>{t.result}</dt>
              <dd>{statusLabel}</dd>
            </div>
          </dl>

          <div className="observation-control-card__actions">
            <button
              type="button"
              className="observation-cancel"
              onClick={() => cancellation.mutate(task.task_id)}
              disabled={!canRequestCancellation || cancellationPending}
            >
              <CircleX aria-hidden="true" />
              {cancellationPending ? t.requestingCancellation : t.requestCancellation}
            </button>
            {cancellationAcknowledged ? (
              <p className="cancellation-status" role="status">{t.cancellationRequested}</p>
            ) : null}
            {taskQuery.isError ? <p className="polling-error">{t.pollingErrorHint}</p> : null}
            {cancellationFailed ? <p className="polling-error">{cancellationError}</p> : null}
            <p className="observation-cancel-note">{t.cancellationRetentionHint}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
