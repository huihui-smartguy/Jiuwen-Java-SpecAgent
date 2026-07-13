import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { activeTask } from '../data/mockData';
import { resolveRuntimeConfig } from '../config/runtime';
import { Observation } from './Observation';

function mockJson(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  } as Response);
}

function mockTaskApi(
  statusResponses: unknown[],
  cancellationResponses: unknown[] = []
) {
  let statusIndex = 0;
  let cancellationIndex = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/logs')) {
      return mockJson({ success: true, total: 0, logs: [] });
    }
    if (init?.method === 'DELETE') {
      const response = cancellationResponses[Math.min(cancellationIndex, cancellationResponses.length - 1)];
      cancellationIndex += 1;
      return mockJson(response);
    }
    const response = statusResponses[Math.min(statusIndex, statusResponses.length - 1)];
    statusIndex += 1;
    return mockJson(response);
  });
}

function countStatusRequests(fetchSpy: ReturnType<typeof vi.spyOn>, taskId: string) {
  return fetchSpy.mock.calls.filter(([input, init]) => (
    String(input) === `/api/tasks/${taskId}` && init?.method !== 'DELETE'
  )).length;
}

type ObservationOverrides = {
  task?: typeof activeTask;
  onTaskStatusChange?: ReturnType<typeof vi.fn>;
};

function renderObservation(overrides?: ObservationOverrides) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const renderPage = (nextOverrides?: ObservationOverrides) => {
    const runtimeConfig = resolveRuntimeConfig();
    const task = nextOverrides?.task ?? activeTask;

    return (
      <QueryClientProvider client={client}>
        <Observation
          language="en"
          selectedSut={runtimeConfig.sutTargets[0]}
          activeTask={task}
          runtimeConfig={runtimeConfig}
          onTaskStatusChange={nextOverrides?.onTaskStatusChange ?? vi.fn()}
        />
      </QueryClientProvider>
    );
  };
  const result = render(renderPage(overrides));

  return {
    ...result,
    rerenderObservation: (nextOverrides?: ObservationOverrides) => {
      result.rerender(renderPage({ ...overrides, ...nextOverrides }));
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Observation', () => {
  test('shows the current command, live backend console, and terminal-only export', async () => {
    mockTaskApi([
      {
        ...activeTask,
        status: 'running',
        uiStatus: undefined,
        isTerminal: undefined,
        canExportLogs: undefined
      }
    ]);

    renderObservation();

    expect(screen.getByRole('heading', { name: /execution details/i })).toBeInTheDocument();
    expect(screen.getByText(/pytest testcase\/save/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /export logs/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('heading', { name: /live logs/i })).toBeInTheDocument();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/tasks/${activeTask.task_id}`,
      expect.any(Object)
    ));
  });

  test('uses the terminal task response to enable the backend-provided log export', async () => {
    const onTaskStatusChange = vi.fn();
    mockTaskApi([
      {
        success: true,
        task_id: activeTask.task_id,
        status: 'success',
        trigger_type: 'feature',
        progress: { total_commands: 5, completed: 5, failed: 0 },
        result: { total_commands: 5, success_count: 5, failed_count: 0 },
        logs: {
          file_path: 'logs/task_20260710.log',
          download_url: '/api/tasks/task_20260710/logs/download'
        }
      }
    ]);

    renderObservation({ onTaskStatusChange });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /export logs/i })).toHaveAttribute(
        'href',
        '/api/tasks/task_20260710/logs/download'
      );
    });
    expect(screen.getAllByText(/success/i).length).toBeGreaterThan(0);
    expect(onTaskStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', canExportLogs: true })
    );
  });

  test('renders a live nested terminal task without inventing a current command', async () => {
    mockTaskApi([
      {
        success: true,
        task: {
          id: activeTask.task_id,
          status: 'completed',
          progress: 100,
          total_scripts: 2,
          executed_scripts: 2,
          failed_scripts: 0,
          queue_position: -1,
          log_dir: 'task_live',
          download_url: 'http://testwise.local/api/download/task_live/execution.log'
        }
      }
    ]);

    renderObservation();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /export logs/i })).toHaveAttribute(
        'href',
        'http://testwise.local/api/download/task_live/execution.log'
      );
    });
    expect(screen.getByText(/no current command has been returned/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /live logs/i })).toBeInTheDocument();
  });

  test('shows the live queue position for a queued task', async () => {
    mockTaskApi([
      {
        success: true,
        task: {
          id: activeTask.task_id,
          status: 'queued',
          progress: 0,
          total_scripts: 2,
          executed_scripts: 0,
          failed_scripts: 0,
          queue_position: 3
        }
      }
    ]);

    renderObservation();

    expect(await screen.findByText(/queue position: 3/i)).toBeInTheDocument();
  });

  test('requests live cancellation and continues showing the polling task state', async () => {
    const runningEnvelope = {
      success: true,
      task: {
        id: activeTask.task_id,
        status: 'running',
        progress: 0,
        total_scripts: 2,
        executed_scripts: 0,
        failed_scripts: 0,
        queue_position: -1
      }
    };
    const fetchSpy = mockTaskApi(
      [runningEnvelope, runningEnvelope],
      [{
          success: true,
          task_id: activeTask.task_id,
          previous_status: 'running',
          message: 'Cancellation signal sent'
      }]
    );
    const user = userEvent.setup();

    renderObservation();

    const button = await screen.findByRole('button', { name: /request cancellation/i });
    await user.click(button);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(`/api/tasks/${activeTask.task_id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' }
      });
    });
    expect(await screen.findByText(/cancellation requested/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request cancellation/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/running/i).length).toBeGreaterThan(0);
  });

  test('scopes a cancellation acknowledgement to the task that requested it', async () => {
    const earlierTask = {
      ...activeTask,
      task_id: 'task_earlier_session'
    };
    const runningEnvelope = (taskId: string) => ({
      success: true,
      task: {
        id: taskId,
        status: 'running',
        progress: 0,
        total_scripts: 1,
        executed_scripts: 0,
        failed_scripts: 0,
        queue_position: -1
      }
    });
    mockTaskApi(
      [runningEnvelope(activeTask.task_id), runningEnvelope(activeTask.task_id), runningEnvelope(earlierTask.task_id)],
      [{
          success: true,
          task_id: activeTask.task_id,
          previous_status: 'running',
          message: 'Cancellation signal sent'
      }]
    );
    const user = userEvent.setup();
    const { rerenderObservation } = renderObservation();

    await user.click(await screen.findByRole('button', { name: /request cancellation/i }));
    expect(await screen.findByText(/cancellation requested/i)).toBeInTheDocument();

    rerenderObservation({ task: earlierTask });

    expect(await screen.findByRole('button', { name: /request cancellation/i })).toBeEnabled();
  });

  test('continues five-second polling after acknowledgement until cancellation reaches a terminal log export', async () => {
    vi.useFakeTimers();
    const runningEnvelope = {
      success: true,
      task: {
        id: activeTask.task_id,
        status: 'running',
        progress: 0,
        total_scripts: 1,
        executed_scripts: 0,
        failed_scripts: 0,
        queue_position: -1
      }
    };
    const cancelledEnvelope = {
      success: true,
      task: {
        id: activeTask.task_id,
        status: 'cancelled',
        progress: 100,
        total_scripts: 1,
        executed_scripts: 1,
        failed_scripts: 0,
        queue_position: -1,
        log_dir: 'task_cancelled',
        download_url: '/api/download/task_cancelled/execution.log'
      }
    };
    const fetchSpy = mockTaskApi(
      [runningEnvelope, runningEnvelope, cancelledEnvelope],
      [{
          success: true,
          task_id: activeTask.task_id,
          previous_status: 'running',
          message: 'Cancellation signal sent'
      }]
    );
    renderObservation();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: /request cancellation/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/cancellation requested/i)).toBeInTheDocument();
    expect(countStatusRequests(fetchSpy, activeTask.task_id)).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(countStatusRequests(fetchSpy, activeTask.task_id)).toBe(3);
    expect(screen.getByRole('link', { name: /export logs/i })).toHaveAttribute(
      'href',
      '/api/download/task_cancelled/execution.log'
    );
    expect(screen.getAllByText(/cancelled/i).length).toBeGreaterThan(0);
  });
});
