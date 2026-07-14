import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { activeTask, mockObservationEvents } from '../data/mockData';
import type { NormalizedTaskStatus, TaskLogEntry } from '../types';
import { LiveLogConsole } from './LiveLogConsole';

function mockJson(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body)
  } as Response);
}

function renderConsole({
  task = activeTask,
  mockEntries
}: {
  task?: NormalizedTaskStatus;
  mockEntries?: readonly TaskLogEntry[];
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const renderView = (nextTask: NormalizedTaskStatus) => (
    <QueryClientProvider client={client}>
      <LiveLogConsole
        language="en"
        api={{ apiBaseUrl: '/api' }}
        task={nextTask}
        mockEntries={mockEntries}
      />
    </QueryClientProvider>
  );
  const result = render(renderView(task));
  return {
    ...result,
    client,
    rerenderTask(nextTask: NormalizedTaskStatus) {
      result.rerender(renderView(nextTask));
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LiveLogConsole', () => {
  test('contains many real lines in the 338px desktop row and releases the row height responsively', async () => {
    const logs = Array.from({ length: 80 }, (_, index) => ({
      timestamp: `2026-07-13 10:00:${String(index).padStart(2, '0')}`,
      level: 'INFO',
      message: `Real log line ${index}`
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: true,
      total: logs.length,
      logs
    }));

    const { container } = renderConsole();

    expect(await screen.findByText('Real log line 79')).toBeInTheDocument();
    const panel = container.querySelector('.live-log-panel');
    const viewport = container.querySelector('.live-log-viewport');
    expect(panel).toContainElement(viewport);
    expect(viewport?.querySelectorAll('.log-line')).toHaveLength(80);

    const observeCss = readFileSync('src/styles/routes/observe.css', 'utf8');
    expect(observeCss).toMatch(
      /\.observation-lower-grid\s*\{[^}]*height:\s*338px;/
    );
    expect(observeCss).toMatch(
      /\.live-log-viewport\s*\{[^}]*min-height:\s*0;/
    );
    expect(observeCss).toMatch(
      /@media \(max-width: 980px\)\s*\{[\s\S]*?\.observation-lower-grid\s*\{[^}]*height:\s*auto;/
    );
  });

  test('renders the real backend snapshot, announces its line count, and removes legacy controls', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: true,
      total: 3,
      logs: [
        { timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Worker started' },
        { timestamp: '2026-07-13 10:00:01', level: 'DEBUG', message: 'Request payload accepted' },
        { timestamp: '2026-07-13 10:00:02', level: 'ERROR', message: 'Assertion failed' }
      ]
    }));

    const { client } = renderConsole();

    expect(await screen.findByText('Worker started')).toBeInTheDocument();
    expect(screen.getByText('Request payload accepted')).toBeInTheDocument();
    expect(screen.getByText('Assertion failed')).toBeInTheDocument();
    expect(screen.getByText('3 log lines are currently visible.')).toHaveAttribute('aria-live', 'polite');
    expect(client.getQueryData(['task-logs', '/api', activeTask.task_id])).toEqual(
      expect.objectContaining({ cursor: '3' })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/tasks/${activeTask.task_id}/logs`,
      { headers: { Accept: 'application/json' } }
    );
    expect(screen.queryByRole('button', { name: /pause|resume|clear|all levels|errors|warnings/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/live connection|connecting|log stream complete/i)).not.toBeInTheDocument();
  });

  test('polls active log snapshots at exactly two seconds', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(await mockJson({
      success: true,
      total: 0,
      logs: []
    }));

    renderConsole();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test('performs one final log refresh when a running task becomes terminal and does not keep polling', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(await mockJson({
      success: true,
      total: 0,
      logs: []
    }));
    const runningTask = { ...activeTask, status: 'running' as const, isTerminal: false };
    const { rerenderTask } = renderConsole({ task: runningTask });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    rerenderTask({ ...runningTask, status: 'success', uiStatus: 'success', isTerminal: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test('auto-scrolls the execution-event viewport when a real snapshot arrives', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(320);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: true,
      total: 1,
      logs: [{ timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Newest output' }]
    }));

    const { container } = renderConsole();

    expect(await screen.findByText('Newest output')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector<HTMLElement>('.live-log-viewport')?.scrollTop).toBe(320);
    });
  });

  test('rejects a non-incremental snapshot while retaining the last successful real lines', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await mockJson({
        success: true,
        total: 1,
        logs: [{ timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Original line' }]
      }))
      .mockResolvedValueOnce(await mockJson({
        success: true,
        total: 1,
        logs: [{ timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Rewritten line' }]
      }));

    const { client } = renderConsole({ mockEntries: mockObservationEvents });
    expect(await screen.findByText('Original line')).toBeInTheDocument();

    await client.refetchQueries({ queryKey: ['task-logs'] });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Original line')).toBeInTheDocument();
    expect(screen.queryByText('Rewritten line')).not.toBeInTheDocument();
    expect(screen.queryByText(mockObservationEvents[0].message)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/logs unavailable/i);
    });
  });

  test('always prefers a successful real snapshot over explicitly supplied mock entries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: true,
      total: 1,
      logs: [{ timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Backend truth' }]
    }));

    renderConsole({ mockEntries: mockObservationEvents });

    expect(await screen.findByText('Backend truth')).toBeInTheDocument();
    expect(screen.queryByText(mockObservationEvents[0].message)).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE STATUS · NOT LIVE LOGS')).not.toBeInTheDocument();
  });

  test('shows approved mock events only after a request failure when they are explicitly supplied', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: false,
      message: 'Log endpoint unavailable'
    }, false, 503));

    renderConsole({ mockEntries: mockObservationEvents });

    expect(await screen.findByText(mockObservationEvents[0].message)).toBeInTheDocument();
    expect(screen.getByText('LIVE STATUS · NOT LIVE LOGS')).toBeInTheDocument();
    expect(screen.getByText(`${mockObservationEvents.length} log lines are currently visible.`)).toBeInTheDocument();
  });

  test('shows a truthful unavailable state and no mock line when the prop is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: false,
      message: 'Log endpoint unavailable'
    }, false, 503));

    renderConsole();

    expect(await screen.findByText('Logs unavailable')).toBeInTheDocument();
    expect(screen.queryByText(mockObservationEvents[0].message)).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE STATUS · NOT LIVE LOGS')).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
