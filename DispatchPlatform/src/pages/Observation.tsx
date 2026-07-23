import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  cancelTask,
  getTaskScriptStatus,
  getTaskStatus,
  listTasks,
  normalizeTaskStatus
} from '../api/client';
import { LiveLogConsole } from '../components/LiveLogConsole';
import { LogExportAction } from '../components/LogExportAction';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { mockObservationEvents } from '../data/mockData';
import { getCopy } from '../i18n';
import {
  objectNameLabel,
  productDisplayLabel,
  sceneDisplayLabel
} from '../objectLabels';
import type {
  Language,
  NormalizedTaskStatus,
  RuntimeConfig,
  SutTarget,
  TaskListTask,
  TaskScriptExecutionStatus,
  TaskScriptStatusResponse,
  UiTaskStatus
} from '../types';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus | null;
  runtimeConfig: RuntimeConfig;
  launchedTask?: { taskId: string; apiBaseUrl: string };
  onTaskStatusChange: (task: NormalizedTaskStatus) => void;
}

interface ObservationDetailProps extends Omit<PageProps, 'activeTask' | 'launchedTask'> {
  activeTask: NormalizedTaskStatus;
  taskList: ReactNode;
}

type StageState = 'complete' | 'current' | 'error' | 'upcoming' | 'neutral';

interface TaskStatusQueryResult {
  task: NormalizedTaskStatus;
  source: 'live' | 'fallback';
}

interface BackendTaskSource {
  apiBaseUrl: string;
  targets: SutTarget[];
}

interface TaskDiscoveryFailure {
  apiBaseUrl: string;
  message: string;
}

interface TaskDiscoveryResult {
  tasks: TaskListTask[];
  failures: TaskDiscoveryFailure[];
  sourceCount: number;
  successfulSourceCount: number;
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

function canonicalApiBaseUrl(value: string) {
  const trimmed = value.trim() || '/api';
  return trimmed === '/' ? trimmed : trimmed.replace(/\/+$/, '');
}

function taskIdentity(sourceApiBaseUrl: string, taskId: string) {
  return `${canonicalApiBaseUrl(sourceApiBaseUrl)}\u0000${taskId}`;
}

function sourceUrlForTask(
  task: NormalizedTaskStatus,
  selectedSut: SutTarget,
  runtimeConfig: RuntimeConfig
) {
  return canonicalApiBaseUrl(
    task.sourceSut?.apiBaseUrl || selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl
  );
}

function configuredBackendSources(runtimeConfig: RuntimeConfig): BackendTaskSource[] {
  const sources = new Map<string, BackendTaskSource>();

  for (const target of runtimeConfig.sutTargets) {
    const apiBaseUrl = canonicalApiBaseUrl(target.apiBaseUrl || runtimeConfig.apiBaseUrl);
    const source = sources.get(apiBaseUrl);
    if (source) {
      source.targets.push(target);
    } else {
      sources.set(apiBaseUrl, { apiBaseUrl, targets: [target] });
    }
  }

  if (!sources.size) {
    const apiBaseUrl = canonicalApiBaseUrl(runtimeConfig.apiBaseUrl);
    sources.set(apiBaseUrl, { apiBaseUrl, targets: [] });
  }

  return Array.from(sources.values());
}

function backendStatusToUi(status: TaskListTask['status']): NormalizedTaskStatus['status'] {
  switch (status) {
    case 'queued':
    case 'pending':
      return 'pending';
    case 'running':
      return 'running';
    case 'completed':
      return 'success';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
  }
}

function targetForSummary(
  summary: TaskListTask,
  sources: readonly BackendTaskSource[],
  fallback: SutTarget
): SutTarget {
  const source = sources.find((candidate) => candidate.apiBaseUrl === summary.sourceApiBaseUrl);
  const exact = source?.targets.find((target) => (
    target.product === summary.product && target.scene === summary.scene
  ));

  if (exact) {
    return { ...exact };
  }

  return {
    id: `discovered:${summary.sourceApiBaseUrl}:${summary.product}:${summary.scene}`,
    name: [summary.product, summary.scene].filter(Boolean).join(' ') || fallback.name,
    product: summary.product || fallback.product,
    scene: summary.scene || fallback.scene,
    version: summary.version || '—',
    apiBaseUrl: summary.sourceApiBaseUrl,
    status: 'healthy'
  };
}

function detailSeedForSummary(
  summary: TaskListTask,
  sources: readonly BackendTaskSource[],
  fallback: SutTarget
): NormalizedTaskStatus {
  const status = backendStatusToUi(summary.status);
  return {
    ...normalizeTaskStatus({
      success: true,
      task_id: summary.task_id,
      status,
      trigger_type: 'feature',
      backend_status: summary.status,
      queue_position: summary.queue_position,
      total_scripts: summary.total_scripts,
      progress: {
        total_commands: summary.total_scripts,
        completed: summary.executed_scripts,
        failed: summary.failed_scripts
      },
      result: status === 'success' || status === 'failed' || status === 'cancelled'
        ? {
            total_commands: summary.total_scripts,
            success_count: Math.max(summary.executed_scripts - summary.failed_scripts, 0),
            failed_count: summary.failed_scripts
          }
        : undefined,
      started_at: summary.started_at ?? summary.created_at,
      completed_at: summary.completed_at ?? undefined,
      version: summary.version
    }),
    sourceSut: targetForSummary(summary, sources, fallback)
  };
}

function summaryForSessionTask(
  task: NormalizedTaskStatus,
  selectedSut: SutTarget,
  runtimeConfig: RuntimeConfig
): TaskListTask {
  const sourceSut = task.sourceSut ?? selectedSut;
  const total = task.total_scripts ?? task.progress?.total_commands ?? task.result?.total_commands ?? 0;
  const executed = task.progress?.completed ?? task.result?.total_commands ?? 0;
  const failed = task.progress?.failed ?? task.result?.failed_count ?? 0;
  const progress = total > 0 ? Math.min(Math.round((executed / total) * 100), 100) : 0;
  const backendStatus = task.backend_status ?? (
    task.status === 'success' ? 'completed' : task.status
  );

  return {
    task_id: task.task_id,
    product: sourceSut.product,
    scene: sourceSut.scene,
    execute_mode: task.trigger_type,
    version: task.version ?? sourceSut.version,
    status: backendStatus,
    progress,
    total_scripts: total,
    executed_scripts: executed,
    failed_scripts: failed,
    queue_position: task.queue_position ?? -1,
    created_at: task.started_at ?? '',
    started_at: task.started_at ?? null,
    completed_at: task.completed_at ?? null,
    sourceApiBaseUrl: sourceUrlForTask(task, selectedSut, runtimeConfig)
  };
}

function sortNewestFirst(tasks: TaskListTask[]) {
  return tasks.sort((left, right) => {
    const leftTime = Date.parse(left.created_at || left.started_at || '') || 0;
    const rightTime = Date.parse(right.created_at || right.started_at || '') || 0;
    return rightTime - leftTime || right.task_id.localeCompare(left.task_id);
  });
}

function mergeTaskSummaries(tasks: readonly TaskListTask[]) {
  const deduplicated = new Map<string, TaskListTask>();
  for (const task of tasks) {
    const identity = taskIdentity(task.sourceApiBaseUrl, task.task_id);
    if (!deduplicated.has(identity)) {
      deduplicated.set(identity, task);
    }
  }
  return sortNewestFirst(Array.from(deduplicated.values()));
}

function taskListStatusLabel(task: TaskListTask, language: Language) {
  const labels = language === 'zh'
    ? {
        queued: '排队中', pending: '等待中', running: '执行中', completed: '已完成',
        failed: '失败', cancelled: '已取消'
      }
    : {
        queued: 'Queued', pending: 'Pending', running: 'Running', completed: 'Completed',
        failed: 'Failed', cancelled: 'Cancelled'
      };
  return labels[task.status];
}

function taskListTime(task: TaskListTask, language: Language) {
  const value = task.started_at ?? task.created_at;
  const formatted = value
    ? value.replace('T', ' ').replace(/(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/, '').slice(0, 16)
    : language === 'zh' ? '时间未知' : 'Time unavailable';
  if ((task.status === 'queued' || task.status === 'pending') && task.queue_position > 0) {
    return language === 'zh'
      ? `队列 #${task.queue_position} · ${formatted}`
      : `Queue #${task.queue_position} · ${formatted}`;
  }
  return formatted;
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

function ExecutionTasksCard({
  language,
  tasks,
  selectedTask,
  discovery,
  isLoading,
  isRefreshing,
  onSelect,
  onRetry
}: {
  language: Language;
  tasks: readonly TaskListTask[];
  selectedTask: NormalizedTaskStatus | null;
  discovery?: TaskDiscoveryResult;
  isLoading: boolean;
  isRefreshing: boolean;
  onSelect: (task: TaskListTask) => void;
  onRetry: () => void;
}) {
  const selectedIdentity = selectedTask
    ? taskIdentity(
        selectedTask.sourceSut?.apiBaseUrl ?? '/api',
        selectedTask.task_id
      )
    : undefined;
  const copy = language === 'zh'
    ? {
        title: '执行任务',
        subtitle: '跨已配置执行后端汇总正在排队、等待与运行的任务。',
        count: `${tasks.length} 个活动任务`,
        loading: '正在加载活动任务…',
        emptyTitle: '当前没有活动任务',
        emptyBody: '观测页会保持可用。创建任务后，最新执行会自动出现在这里。',
        schedule: '前往任务调度',
        partial: `部分执行后端暂不可用；已保留 ${discovery?.successfulSourceCount ?? 0} 个后端返回的任务。`,
        total: '暂时无法连接任何执行后端。页面不会跳转，您可以在此重试。',
        retry: isRefreshing ? '正在重试…' : '重试',
        id: '任务 ID',
        scope: '对象 / 范围',
        version: '版本',
        status: '状态',
        progress: '进度',
        time: '开始 / 排队时间',
        action: '操作',
        view: '查看',
        viewing: '查看中',
        scripts: '脚本'
      }
    : {
        title: 'Execution tasks',
        subtitle: 'Active queued, pending, and running tasks across configured execution backends.',
        count: `${tasks.length} active`,
        loading: 'Loading active tasks…',
        emptyTitle: 'No active tasks',
        emptyBody: 'Observation stays available. The newest execution will appear here after you launch it.',
        schedule: 'Go to Task Scheduling',
        partial: `Some execution backends are unavailable. Tasks from ${discovery?.successfulSourceCount ?? 0} responding backends are retained.`,
        total: 'No execution backend can be reached right now. This page stays available so you can retry.',
        retry: isRefreshing ? 'Retrying…' : 'Retry',
        id: 'Task ID',
        scope: 'Object / scope',
        version: 'Version',
        status: 'Status',
        progress: 'Progress',
        time: 'Started / queued',
        action: 'Action',
        view: 'View',
        viewing: 'Viewing',
        scripts: 'scripts'
      };
  const failures = discovery?.failures ?? [];
  const totalFailure = Boolean(discovery?.sourceCount) && failures.length === discovery?.sourceCount;

  return (
    <section
      className="observation-task-list-card"
      aria-labelledby="execution-tasks-title"
      aria-busy={isLoading || undefined}
    >
      <header className="observation-task-list-card__heading">
        <div>
          <h2 id="execution-tasks-title">{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <span aria-live="polite">{copy.count}</span>
      </header>

      {failures.length ? (
        <div className={`observation-task-list-warning${totalFailure ? ' is-total' : ''}`} role="alert">
          <p>{totalFailure ? copy.total : copy.partial}</p>
          <button type="button" onClick={onRetry} disabled={isRefreshing}>
            {copy.retry}
          </button>
        </div>
      ) : null}

      {isLoading && !tasks.length ? (
        <p className="observation-task-list-state" role="status">{copy.loading}</p>
      ) : tasks.length ? (
        <div className="observation-task-table-scroll">
          <table aria-label={copy.title}>
            <thead>
              <tr>
                <th>{copy.id}</th>
                <th>{copy.scope}</th>
                <th>{copy.version}</th>
                <th>{copy.status}</th>
                <th>{copy.progress}</th>
                <th>{copy.time}</th>
                <th>{copy.action}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const identity = taskIdentity(task.sourceApiBaseUrl, task.task_id);
                const selected = identity === selectedIdentity;
                const progressLabel = `${task.executed_scripts} / ${task.total_scripts}`;
                return (
                  <tr key={identity} aria-current={selected ? 'true' : undefined}>
                    <td data-label={copy.id}>
                      <strong title={task.task_id}>{task.task_id}</strong>
                      <small>{task.execute_mode ?? '—'}</small>
                    </td>
                    <td data-label={copy.scope}>
                      <strong>{productDisplayLabel(task.product)}</strong>
                      <small>
                        {[sceneDisplayLabel(task.scene), task.feature].filter(Boolean).join(' · ')}
                      </small>
                    </td>
                    <td data-label={copy.version}>{task.version ?? '—'}</td>
                    <td data-label={copy.status}>
                      <span className={`observation-list-status is-${task.status}`}>
                        {taskListStatusLabel(task, language)}
                      </span>
                    </td>
                    <td data-label={copy.progress}>
                      <div className="observation-list-progress">
                        <progress value={task.progress} max="100" aria-label={`${copy.progress}: ${task.progress}%`} />
                        <span>{task.progress}% · {progressLabel} {copy.scripts}</span>
                      </div>
                    </td>
                    <td data-label={copy.time}>{taskListTime(task, language)}</td>
                    <td data-label={copy.action}>
                      <button
                        type="button"
                        className="observation-task-view"
                        aria-pressed={selected}
                        onClick={() => onSelect(task)}
                      >
                        {selected ? copy.viewing : copy.view}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="observation-task-list-empty">
          <strong>{copy.emptyTitle}</strong>
          <p>{copy.emptyBody}</p>
          <Link to="/tasks">{copy.schedule} →</Link>
        </div>
      )}
    </section>
  );
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

function ObservationDetail({
  language,
  selectedSut,
  activeTask,
  runtimeConfig,
  onTaskStatusChange,
  taskList
}: ObservationDetailProps) {
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

      {taskList}

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
          value={objectNameLabel(taskSut)}
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

export function Observation({
  language,
  selectedSut,
  activeTask,
  runtimeConfig,
  launchedTask,
  onTaskStatusChange
}: PageProps) {
  const t = getCopy(language);
  const sources = useMemo(
    () => configuredBackendSources(runtimeConfig),
    [runtimeConfig]
  );
  const launchedTaskIdentity = launchedTask
    ? taskIdentity(launchedTask.apiBaseUrl, launchedTask.taskId)
    : undefined;
  const initialActiveTaskIdentity = activeTask
    ? taskIdentity(sourceUrlForTask(activeTask, selectedSut, runtimeConfig), activeTask.task_id)
    : undefined;
  const [selectedTask, setSelectedTask] = useState<NormalizedTaskStatus | null>(() => (
    activeTask
      && !activeTask.isTerminal
      && (runtimeConfig.enableMockFallback || initialActiveTaskIdentity === launchedTaskIdentity)
      ? activeTask
      : null
  ));
  const initialSelectionResolvedRef = useRef(false);
  const incomingTaskIdentity = activeTask
    ? taskIdentity(sourceUrlForTask(activeTask, selectedSut, runtimeConfig), activeTask.task_id)
    : undefined;
  const lastIncomingTaskIdentityRef = useRef(incomingTaskIdentity);
  const discoveryQuery = useQuery<TaskDiscoveryResult>({
    queryKey: ['active-task-list', sources.map((source) => source.apiBaseUrl).join('|')],
    queryFn: async () => {
      const results = await Promise.allSettled(sources.map(async (source) => (
        listTasks(
          { apiBaseUrl: source.apiBaseUrl },
          { statuses: ['queued', 'pending', 'running'], limit: 100, offset: 0 }
        )
      )));
      const tasks: TaskListTask[] = [];
      const failures: TaskDiscoveryFailure[] = [];
      let successfulSourceCount = 0;

      results.forEach((result, index) => {
        const source = sources[index];
        if (!source) {
          return;
        }
        if (result.status === 'fulfilled') {
          successfulSourceCount += 1;
          tasks.push(...result.value.tasks);
        } else {
          failures.push({
            apiBaseUrl: source.apiBaseUrl,
            message: result.reason instanceof Error ? result.reason.message : String(result.reason)
          });
        }
      });

      return {
        tasks: mergeTaskSummaries(tasks),
        failures,
        sourceCount: sources.length,
        successfulSourceCount
      };
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    retry: false
  });
  const discoveredTasks = discoveryQuery.data?.tasks ?? [];
  const visibleTasks = useMemo(() => {
    const sessionTask = activeTask && !activeTask.isTerminal
      ? summaryForSessionTask(activeTask, selectedSut, runtimeConfig)
      : undefined;
    return mergeTaskSummaries(sessionTask
      ? [...discoveredTasks, sessionTask]
      : discoveredTasks);
  }, [activeTask, discoveredTasks, runtimeConfig, selectedSut]);

  useEffect(() => {
    if (!activeTask || !incomingTaskIdentity) {
      return;
    }
    const previousIncomingIdentity = lastIncomingTaskIdentityRef.current;
    lastIncomingTaskIdentityRef.current = incomingTaskIdentity;
    setSelectedTask((current) => {
      const currentIdentity = current
        ? taskIdentity(sourceUrlForTask(current, selectedSut, runtimeConfig), current.task_id)
        : undefined;
      if (activeTask.isTerminal) {
        return currentIdentity === incomingTaskIdentity ? activeTask : current;
      }
      const isNewlyLaunchedTask = previousIncomingIdentity !== incomingTaskIdentity;
      const isLaunchNavigation = incomingTaskIdentity === launchedTaskIdentity;
      return currentIdentity === incomingTaskIdentity
        || isNewlyLaunchedTask
        || (!current && (isLaunchNavigation || runtimeConfig.enableMockFallback))
        ? activeTask
        : current;
    });
  }, [activeTask, incomingTaskIdentity, launchedTaskIdentity, runtimeConfig, selectedSut]);

  useEffect(() => {
    if (discoveryQuery.isPending || initialSelectionResolvedRef.current) {
      return;
    }
    initialSelectionResolvedRef.current = true;
    const newestTask = visibleTasks[0];
    if (!newestTask) {
      return;
    }
    setSelectedTask((current) => {
      return current ?? detailSeedForSummary(newestTask, sources, selectedSut);
    });
  }, [discoveryQuery.isPending, runtimeConfig, selectedSut, sources, visibleTasks]);

  const handleSelect = useCallback((summary: TaskListTask) => {
    setSelectedTask(detailSeedForSummary(summary, sources, selectedSut));
  }, [selectedSut, sources]);
  const handleTaskStatusChange = useCallback((task: NormalizedTaskStatus) => {
    const nextIdentity = taskIdentity(sourceUrlForTask(task, selectedSut, runtimeConfig), task.task_id);
    setSelectedTask((current) => {
      if (!current) {
        return task;
      }
      const currentIdentity = taskIdentity(
        sourceUrlForTask(current, selectedSut, runtimeConfig),
        current.task_id
      );
      return currentIdentity === nextIdentity
        ? {
            ...task,
            version: task.version ?? current.version,
            sourceSut: task.sourceSut ?? current.sourceSut
          }
        : current;
    });
    onTaskStatusChange(task);
  }, [onTaskStatusChange, runtimeConfig, selectedSut]);
  const taskList = (
    <ExecutionTasksCard
      language={language}
      tasks={visibleTasks}
      selectedTask={selectedTask}
      discovery={discoveryQuery.data}
      isLoading={discoveryQuery.isPending}
      isRefreshing={discoveryQuery.isFetching && !discoveryQuery.isPending}
      onSelect={handleSelect}
      onRetry={() => { void discoveryQuery.refetch(); }}
    />
  );

  if (!selectedTask) {
    return (
      <div className="page-stack observation-page">
        <PageHeader title={t.observation} subtitle={t.observationSubtitle} />
        {taskList}
      </div>
    );
  }

  return (
    <ObservationDetail
      language={language}
      selectedSut={selectedSut}
      activeTask={selectedTask}
      runtimeConfig={runtimeConfig}
      onTaskStatusChange={handleTaskStatusChange}
      taskList={taskList}
    />
  );
}
