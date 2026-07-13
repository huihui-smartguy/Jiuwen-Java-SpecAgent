import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { activeTask } from '../data/mockData';
import type { NormalizedTaskStatus } from '../types';
import { LiveLogConsole } from './LiveLogConsole';

function mockJson(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body)
  } as Response);
}

function renderConsole(task: NormalizedTaskStatus = activeTask) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const renderView = (nextTask: NormalizedTaskStatus) => (
    <QueryClientProvider client={client}>
      <LiveLogConsole
        language="en"
        api={{ apiBaseUrl: '/api' }}
        task={nextTask}
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
  test('renders backend log lines and filters without mutating the fetched snapshot', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: true,
      total: 3,
      logs: [
        { timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Worker started' },
        { timestamp: '2026-07-13 10:00:01', level: 'DEBUG', message: 'Request payload accepted' },
        { timestamp: '2026-07-13 10:00:02', level: 'ERROR', message: 'Assertion failed' }
      ]
    }));
    const user = userEvent.setup();

    renderConsole();

    expect(await screen.findByText('Worker started')).toBeInTheDocument();
    expect(screen.getByText('Request payload accepted')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /errors/i }));
    expect(screen.queryByText('Worker started')).not.toBeInTheDocument();
    expect(screen.getByText('Assertion failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /all levels/i }));
    expect(screen.getByText('Worker started')).toBeInTheDocument();
  });

  test('pause stops two-second log polling without clearing the current viewport', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(await mockJson({
      success: true,
      total: 1,
      logs: [{ timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Still visible' }]
    }));

    renderConsole();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    act(() => screen.getByRole('button', { name: /pause logs/i }).click());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Still visible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume logs/i })).toBeInTheDocument();
  });

  test('clear is local and newly fetched lines appear after its boundary', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await mockJson({
        success: true,
        total: 1,
        logs: [{ timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Before clear' }]
      }))
      .mockResolvedValueOnce(await mockJson({
        success: true,
        total: 2,
        logs: [
          { timestamp: '2026-07-13 10:00:00', level: 'INFO', message: 'Before clear' },
          { timestamp: '2026-07-13 10:00:02', level: 'INFO', message: 'After clear' }
        ]
      }));

    const { client } = renderConsole();
    expect(await screen.findByText('Before clear')).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: /clear viewport/i }).click());
    expect(screen.queryByText('Before clear')).not.toBeInTheDocument();

    await client.refetchQueries({ queryKey: ['task-logs'] });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Before clear')).not.toBeInTheDocument();
    expect(await screen.findByText('After clear')).toBeInTheDocument();
  });

  test('performs one final log fetch when a running task becomes terminal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(await mockJson({
      success: true,
      total: 0,
      logs: []
    }));
    const runningTask = { ...activeTask, status: 'running' as const, isTerminal: false };
    const { rerenderTask } = renderConsole(runningTask);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    rerenderTask({ ...runningTask, status: 'success', uiStatus: 'success', isTerminal: true });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

  test('shows an explicit unavailable state and never fabricates fallback lines', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await mockJson({
      success: false,
      message: 'Log endpoint unavailable'
    }, false, 503));

    renderConsole();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/logs unavailable/i));
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  test('rejects a non-incremental snapshot instead of replacing previously fetched logs', async () => {
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

    const { client } = renderConsole();
    expect(await screen.findByText('Original line')).toBeInTheDocument();

    await client.refetchQueries({ queryKey: ['task-logs'] });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('status')).toHaveTextContent(/logs unavailable/i);
    expect(screen.queryByText('Rewritten line')).not.toBeInTheDocument();
  });
});
