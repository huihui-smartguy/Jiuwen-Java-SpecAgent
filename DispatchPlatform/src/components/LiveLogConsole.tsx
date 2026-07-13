import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, Pause, Play, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getTaskLogs } from '../api/client';
import { getCopy } from '../i18n';
import type {
  ApiContext,
  Language,
  NormalizedTaskStatus,
  TaskLogLevel,
  TaskLogSnapshot
} from '../types';

interface LiveLogConsoleProps {
  language: Language;
  api: ApiContext;
  task: NormalizedTaskStatus;
}

const levelFilters: Array<TaskLogLevel | 'all'> = [
  'all',
  'debug',
  'info',
  'warn',
  'error',
  'log'
];

function isPollingTask(task: NormalizedTaskStatus) {
  return task.status === 'pending' || task.status === 'running';
}

function isIncrementalSnapshot(previous: TaskLogSnapshot, next: TaskLogSnapshot) {
  const previousTotal = Number(previous.cursor);
  const nextTotal = Number(next.cursor);
  if (!Number.isSafeInteger(previousTotal) || !Number.isSafeInteger(nextTotal) || nextTotal < previousTotal) {
    return false;
  }

  const previousStart = previousTotal - previous.entries.length;
  const nextStart = nextTotal - next.entries.length;
  const overlapStart = Math.max(previousStart, nextStart);
  const overlapEnd = Math.min(previousTotal, nextTotal);

  for (let position = overlapStart; position < overlapEnd; position += 1) {
    const previousEntry = previous.entries[position - previousStart];
    const nextEntry = next.entries[position - nextStart];
    if (
      !previousEntry
      || !nextEntry
      || previousEntry.timestamp !== nextEntry.timestamp
      || previousEntry.level !== nextEntry.level
      || previousEntry.message !== nextEntry.message
    ) {
      return false;
    }
  }

  return true;
}

export function LiveLogConsole({ language, api, task }: LiveLogConsoleProps) {
  const t = getCopy(language);
  const [paused, setPaused] = useState(false);
  const [activeLevel, setActiveLevel] = useState<TaskLogLevel | 'all'>('all');
  const [clearBoundary, setClearBoundary] = useState<string>();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef(task.status);
  const snapshotRef = useRef<{ taskKey: string; snapshot?: TaskLogSnapshot } | undefined>(undefined);
  const taskKey = `${api.apiBaseUrl}:${task.task_id}`;
  const logQuery = useQuery({
    queryKey: ['task-logs', api.apiBaseUrl, task.task_id],
    queryFn: async () => {
      const nextSnapshot = await getTaskLogs(api, task.task_id, task.logs?.view_url);
      const previousState = snapshotRef.current;
      if (
        previousState?.taskKey === taskKey
        && previousState.snapshot
        && !isIncrementalSnapshot(previousState.snapshot, nextSnapshot)
      ) {
        throw new ApiError('The task log response is not incremental', {
          code: 'NON_INCREMENTAL_LOG_RESPONSE'
        });
      }
      snapshotRef.current = { taskKey, snapshot: nextSnapshot };
      return nextSnapshot;
    },
    refetchInterval: paused || !isPollingTask(task) ? false : 2000,
    refetchIntervalInBackground: true,
    retry: false
  });

  useEffect(() => {
    const wasPolling = previousStatusRef.current === 'pending'
      || previousStatusRef.current === 'running';
    if (wasPolling && task.isTerminal) {
      void logQuery.refetch();
    }
    previousStatusRef.current = task.status;
  }, [logQuery.refetch, task.isTerminal, task.status]);

  const fetchedEntries = logQuery.data?.entries ?? [];
  const viewportEntries = useMemo(() => {
    if (!clearBoundary) {
      return fetchedEntries;
    }
    const boundaryIndex = fetchedEntries.findIndex((entry) => entry.id === clearBoundary);
    return boundaryIndex >= 0 ? fetchedEntries.slice(boundaryIndex + 1) : fetchedEntries;
  }, [clearBoundary, fetchedEntries]);
  const filteredEntries = activeLevel === 'all'
    ? viewportEntries
    : viewportEntries.filter((entry) => entry.level === activeLevel);

  useEffect(() => {
    if (!paused && scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [filteredEntries, paused]);

  const connectionLabel = logQuery.isError
    ? t.logsUnavailable
    : paused
      ? t.logsPaused
      : task.isTerminal
        ? t.logsComplete
        : logQuery.isFetching
          ? t.logsConnecting
          : t.logsConnected;

  return (
    <section className="panel live-log-panel" aria-labelledby="live-log-title">
      <div className="panel-heading live-log-heading">
        <div>
          <p className="eyebrow">{t.backendStream}</p>
          <h2 id="live-log-title">{t.liveLogs}</h2>
        </div>
        <div className="live-log-connection" role="status" aria-live="polite">
          <span className="live-log-connection__dot" aria-hidden="true" />
          {connectionLabel}
        </div>
      </div>

      <div className="live-log-toolbar">
        <div className="live-log-filters" aria-label={t.logLevelFilters}>
          {levelFilters.map((level) => (
            <button
              key={level}
              type="button"
              className={`log-filter ${activeLevel === level ? 'is-active' : ''}`}
              aria-pressed={activeLevel === level}
              aria-label={level === 'all' ? t.allLevels : undefined}
              onClick={() => setActiveLevel(level)}
            >
              {level === 'all' ? t.all : level === 'warn' ? t.warnings : level === 'error' ? t.errors : level}
            </button>
          ))}
        </div>
        <div className="live-log-actions">
          <button
            type="button"
            className="icon-text-button"
            aria-label={paused ? t.resumeLogs : t.pauseLogs}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            <span>{paused ? t.resume : t.pause}</span>
          </button>
          <button
            type="button"
            className="icon-text-button"
            aria-label={t.clearViewport}
            onClick={() => setClearBoundary(fetchedEntries.at(-1)?.id ?? '__empty__')}
          >
            <Trash2 aria-hidden="true" />
            <span>{t.clear}</span>
          </button>
        </div>
      </div>

      <div className="live-log-viewport" ref={scrollViewportRef} tabIndex={0}>
        {logQuery.isError ? (
          <div className="live-log-empty">
            <strong>{t.logsUnavailable}</strong>
            <span>{t.logsUnavailableHint}</span>
          </div>
        ) : filteredEntries.length > 0 ? (
          <ol className="live-log-lines" aria-label={t.liveLogs}>
            {filteredEntries.map((entry) => (
              <li key={entry.id} className={`log-line log-line--${entry.level}`}>
                <time>{entry.timestamp ?? '—'}</time>
                <span className="log-line__level">{entry.level}</span>
                <span className="log-line__message">{entry.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="live-log-empty">
            <ArrowDownToLine aria-hidden="true" />
            <strong>{activeLevel === 'all' ? t.waitingForLogs : t.noMatchingLogs}</strong>
            <span>{activeLevel === 'all' ? t.waitingForLogsHint : t.noMatchingLogsHint}</span>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {t.logLineCount.replace('{count}', String(filteredEntries.length))}
      </p>
    </section>
  );
}
