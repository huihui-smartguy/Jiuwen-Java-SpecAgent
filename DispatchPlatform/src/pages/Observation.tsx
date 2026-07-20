import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  cancelTask,
  getTaskScriptStatus,
  getTaskStatus,
  normalizeTaskStatus
} from '../api/client';
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
  TaskScriptExecutionStatus,
  TaskScriptStatusResponse,
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

function scriptStatusLabel(
  status: TaskScriptExecutionStatus,
  language: Language
) {
  const labels = language === 'zh'
    ? { todo: '待执行', pass: '通过', failed: '失败', running: '执行中' }
    : { todo: 'Pending', pass: 'Passed', failed: 'Failed', running: 'Running' };
  return labels[status];
}

function ObservationMetric({
  label,
  value,
  detail
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
}) {
  return (
    <article className="observation-metric-card" aria-label={label}>
      <h2>{label}</h2>
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
  const [caseStatusOpen, setCaseStatusOpen] = useState(false);
  const caseStatusTriggerRef = useRef<HTMLButtonElement>(null);
  const caseStatusCloseRef = useRef<HTMLButtonElement>(null);
  const caseStatusDrawerRef = useRef<HTMLElement>(null);
  const lastValidTaskRef = useRef(activeTask);
  const taskSut = activeTask.sourceSut ?? selectedSut;
  const api = useMemo(
    () => ({ apiBaseUrl: taskSut.apiBaseUrl || runtimeConfig.apiBaseUrl }),
    [runtimeConfig.apiBaseUrl, taskSut.apiBaseUrl]
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
  const retainedTask = lastValidTaskRef.current.task_id === activeTask.task_id
    ? lastValidTaskRef.current
    : activeTask;
  const latestLiveTask = taskQuery.data?.source === 'live' ? taskQuery.data.task : undefined;
  const latestValidTask = latestLiveTask
    ? {
        ...latestLiveTask,
        version: latestLiveTask.version ?? activeTask.version,
        sourceSut: latestLiveTask.sourceSut ?? activeTask.sourceSut
      }
    : retainedTask;
  const task = taskQuery.isError ? asPollingError(latestValidTask) : latestValidTask;
  const scriptStatusQuery = useQuery<TaskScriptStatusResponse>({
    queryKey: ['task-script-status', api.apiBaseUrl, task.task_id],
    queryFn: async () => {
      try {
        return await getTaskScriptStatus(api, task.task_id);
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return {
            success: true,
            task_id: task.task_id,
            scripts_status: [],
            summary: { todo_count: 0, pass_count: 0, failed_count: 0, running_count: 0 }
          };
        }
        throw error;
      }
    },
    enabled: caseStatusOpen,
    refetchInterval: caseStatusOpen && isPollingTask(task) ? 2000 : false,
    refetchIntervalInBackground: false
  });
  const progress = task.progress;
  const completedCommands = progress?.completed ?? task.result?.success_count ?? 0;
  const totalCommands = progress?.total_commands ?? task.result?.total_commands ?? 0;
  const currentCommand = stripCommandPrefix(progress?.current_command, t.noCurrentCommand);
  const cancellationAcknowledged = cancellationRequestedTaskId === task.task_id;
  const cancellationAwaitingConfirmation = cancellationAcknowledged && isPollingTask(task);
  const cancellationConfirmed = cancellationAcknowledged && task.status === 'cancelled';
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
    language === 'zh' ? '保存 API' : t.saveApi,
    language === 'zh' ? '查询 API' : t.queryApi,
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

  const returnedScriptCount = scriptStatusQuery.data?.scripts_status.length ?? 0;
  const authoritativeScriptTotal = task.total_scripts ?? totalCommands;
  const pendingScriptCount = Math.max(authoritativeScriptTotal - returnedScriptCount, 0);

  useEffect(() => {
    if (taskQuery.data?.source !== 'live') {
      return;
    }
    lastValidTaskRef.current = {
      ...taskQuery.data.task,
      version: taskQuery.data.task.version ?? activeTask.version,
      sourceSut: taskQuery.data.task.sourceSut ?? activeTask.sourceSut
    };
  }, [activeTask.sourceSut, activeTask.version, taskQuery.data]);

  useEffect(() => {
    if (taskQuery.data?.source === 'live') {
      onTaskStatusChange({
        ...taskQuery.data.task,
        version: taskQuery.data.task.version ?? activeTask.version,
        sourceSut: taskSut
      });
    }
  }, [activeTask.version, onTaskStatusChange, taskQuery.data, taskSut]);

  useEffect(() => {
    if (
      cancellationRequestedTaskId === task.task_id
      && task.isTerminal
      && task.status !== 'cancelled'
    ) {
      setCancellationRequestedTaskId(undefined);
    }
  }, [cancellationRequestedTaskId, task.isTerminal, task.status, task.task_id]);

  const closeCaseStatus = () => {
    setCaseStatusOpen(false);
    queueMicrotask(() => caseStatusTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!caseStatusOpen) {
      return undefined;
    }
    caseStatusCloseRef.current?.focus();
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setCaseStatusOpen(false);
        queueMicrotask(() => caseStatusTriggerRef.current?.focus());
        return;
      }
      if (event.key === 'Tab') {
        const focusable = Array.from(
          caseStatusDrawerRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) {
          event.preventDefault();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [caseStatusOpen]);

  useEffect(() => {
    setCaseStatusOpen(false);
    setCancellationRequestedTaskId((current) => current === task.task_id ? current : undefined);
  }, [task.task_id]);

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
            : compactTaskId(task.task_id)}
        />
        <ObservationMetric
          label={t.commandProgress}
          value={`${completedCommands} / ${totalCommands}`}
          detail={`${t.current}: ${currentCommand}`}
        />
        <ObservationMetric
          label={t.elapsedTime}
          value={task.elapsed_time ?? t.notAvailable}
          detail={`${t.estimatedRemaining}: ${task.estimated_remaining ?? t.notAvailable}`}
        />
        <ObservationMetric
          label="Object"
          value={taskSut.name}
          detail={`${taskSut.version} · ${t[taskSut.status]}`}
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
                    ? language === 'zh' ? '等待中' : t.stagePending
                    : t.notAvailable;
            return (
              <li key={label} data-stage-state={state}>
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
              {connectionLabel}
            </span>
          </header>

          <dl className="observation-task-metadata">
            <div>
              <dt>{t.taskId}</dt>
              <dd title={task.task_id}>{compactTaskId(task.task_id)}</dd>
            </div>
            <div>
              <dt>{t.testVersion}</dt>
              <dd>{task.version ?? t.notAvailable}</dd>
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
            <div className="observation-action-row">
              <button
                ref={caseStatusTriggerRef}
                type="button"
                className="observation-case-status"
                onClick={() => setCaseStatusOpen(true)}
              >
                {t.viewCaseStatus}
              </button>
              <button
                type="button"
                className="observation-cancel"
                onClick={() => cancellation.mutate(task.task_id)}
                disabled={!canRequestCancellation || cancellationPending}
              >
                {cancellationPending ? t.requestingCancellation : t.requestCancellation}
              </button>
            </div>
            {cancellationAwaitingConfirmation ? (
              <p className="cancellation-status" role="status">{t.cancellationRequested}</p>
            ) : cancellationConfirmed ? (
              <p className="cancellation-status" role="status">
                {language === 'zh' ? '执行端已确认任务取消。' : 'Cancellation confirmed by the executor.'}
              </p>
            ) : null}
            {taskQuery.isError ? <p className="polling-error">{t.pollingErrorHint}</p> : null}
            {cancellationFailed ? <p className="polling-error">{cancellationError}</p> : null}
            <p className="observation-cancel-note">
              {language === 'zh'
                ? '当前子进程会先执行完成；执行端将在下一个脚本边界安全停止，并保留已完成步骤和结果。'
                : 'The current subprocess finishes first; the executor stops safely at the next script boundary and retains completed steps and results.'}
            </p>
          </div>
        </section>
      </div>

      {caseStatusOpen ? (
        <div
          className="observation-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCaseStatus();
            }
          }}
        >
          <aside
            ref={caseStatusDrawerRef}
            className="observation-case-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-status-title"
          >
            <header>
              <div>
                <p>{compactTaskId(task.task_id)} · {task.version ?? t.notAvailable}</p>
                <h2 id="case-status-title">{t.caseStatus}</h2>
              </div>
              <button
                ref={caseStatusCloseRef}
                type="button"
                aria-label={t.closeCaseStatus}
                onClick={closeCaseStatus}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            {scriptStatusQuery.data ? (
              <p className="observation-case-summary" role="status">
                {language === 'zh'
                  ? `${scriptStatusQuery.data.summary.pass_count} 通过 · ${scriptStatusQuery.data.summary.running_count} 执行中 · ${scriptStatusQuery.data.summary.failed_count} 失败 · ${pendingScriptCount} 待执行`
                  : `${scriptStatusQuery.data.summary.pass_count} passed · ${scriptStatusQuery.data.summary.running_count} running · ${scriptStatusQuery.data.summary.failed_count} failed · ${pendingScriptCount} pending`}
              </p>
            ) : null}

            {scriptStatusQuery.isLoading ? (
              <p className="observation-drawer-state">{t.loadingCaseStatus}</p>
            ) : scriptStatusQuery.isError ? (
              <p className="observation-drawer-state is-error" role="alert">
                {scriptStatusQuery.error instanceof ApiError
                  ? scriptStatusQuery.error.message
                  : t.caseStatusUnavailable}
              </p>
            ) : scriptStatusQuery.data?.scripts_status.length ? (
              <div className="observation-case-table-scroll">
                <table aria-label={t.caseStatus}>
                  <thead>
                    <tr>
                      <th>{language === 'zh' ? '用例' : 'Case'}</th>
                      <th>{t.status}</th>
                      <th>{language === 'zh' ? '批次' : 'Batch'}</th>
                      <th>{language === 'zh' ? '耗时' : 'Duration'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scriptStatusQuery.data.scripts_status.map((script) => (
                      <tr key={script.script_id}>
                        <td>
                          <strong>{script.script_name}</strong>
                          {script.error_message ? <small>{script.error_message}</small> : null}
                        </td>
                        <td>
                          <span className={`observation-case-state is-${script.status}`}>
                            {scriptStatusLabel(script.status, language)}
                          </span>
                        </td>
                        <td>{script.version}</td>
                        <td>
                          {script.duration_seconds === null
                            ? t.notAvailable
                            : `${script.duration_seconds.toFixed(1)}s`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="observation-drawer-state">{t.noCaseStatus}</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
