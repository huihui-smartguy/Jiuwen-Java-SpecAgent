import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ApiError, getTaskLogs } from '../api/client';
import { getCopy } from '../i18n';
import type {
  ApiContext,
  Language,
  NormalizedTaskStatus,
  TaskLogEntry,
  TaskLogSnapshot
} from '../types';

interface LiveLogConsoleProps {
  language: Language;
  api: ApiContext;
  task: NormalizedTaskStatus;
  mockEntries?: readonly TaskLogEntry[];
}

const noEntries: readonly TaskLogEntry[] = [];

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

export function LiveLogConsole({
  language,
  api,
  task,
  mockEntries
}: LiveLogConsoleProps) {
  const t = getCopy(language);
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
    refetchInterval: isPollingTask(task) ? 2000 : false,
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

  const hasRealSnapshot = logQuery.data !== undefined;
  const showMockEntries = !hasRealSnapshot
    && logQuery.isError
    && Boolean(mockEntries?.length);
  const visibleEntries = hasRealSnapshot
    ? logQuery.data.entries
    : showMockEntries
      ? mockEntries ?? noEntries
      : noEntries;
  const showUnavailable = logQuery.isError && !hasRealSnapshot && !showMockEntries;

  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [visibleEntries]);

  return (
    <section className="live-log-panel" aria-labelledby="execution-events-title">
      <header className="live-log-heading">
        <h2 id="execution-events-title">{t.executionEvents}</h2>
        {showMockEntries ? (
          <span className="live-log-disclosure">LIVE STATUS · NOT LIVE LOGS</span>
        ) : null}
      </header>

      <div
        className="live-log-viewport"
        ref={scrollViewportRef}
        tabIndex={0}
        aria-label={t.executionEvents}
      >
        {showUnavailable ? (
          <div className="live-log-empty" role="status">
            <strong>{t.logsUnavailable}</strong>
            <span>{t.logsUnavailableHint}</span>
          </div>
        ) : visibleEntries.length > 0 ? (
          <ol className="live-log-lines" aria-label={t.executionEvents}>
            {visibleEntries.map((entry) => (
              <li key={entry.id} className={`log-line log-line--${entry.level}`}>
                <time>{entry.timestamp ?? ''}</time>
                <span className="sr-only">{entry.level}</span>
                <span className="log-line__message">{entry.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="live-log-empty">
            <ArrowDownToLine aria-hidden="true" />
            <strong>{t.waitingForLogs}</strong>
            <span>{t.waitingForLogsHint}</span>
          </div>
        )}
      </div>

      {logQuery.isError && hasRealSnapshot ? (
        <p className="sr-only" role="status">{t.logsUnavailable}</p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {t.logLineCount.replace('{count}', String(visibleEntries.length))}
      </p>
    </section>
  );
}
