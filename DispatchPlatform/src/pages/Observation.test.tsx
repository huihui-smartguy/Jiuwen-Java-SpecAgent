import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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

function renderObservation(overrides?: { task?: typeof activeTask; onTaskStatusChange?: ReturnType<typeof vi.fn> }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const runtimeConfig = resolveRuntimeConfig();
  const task = overrides?.task ?? activeTask;

  return render(
    <QueryClientProvider client={client}>
      <Observation
        language="en"
        selectedSut={runtimeConfig.sutTargets[0]}
        activeTask={task}
        runtimeConfig={runtimeConfig}
        onTaskStatusChange={overrides?.onTaskStatusChange ?? vi.fn()}
      />
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Observation', () => {
  test('shows the current command in execution details while keeping logs terminal-only', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        ...activeTask,
        status: 'running',
        uiStatus: undefined,
        isTerminal: undefined,
        canExportLogs: undefined
      })
    );

    renderObservation();

    expect(screen.getByRole('heading', { name: /execution details/i })).toBeInTheDocument();
    expect(screen.getByText(/pytest testcase\/save/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /export logs/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.queryByText(/live log/i)).not.toBeInTheDocument();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/tasks/${activeTask.task_id}`,
      expect.any(Object)
    ));
  });

  test('uses the terminal task response to enable the backend-provided log export', async () => {
    const onTaskStatusChange = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
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
      })
    );

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
});
