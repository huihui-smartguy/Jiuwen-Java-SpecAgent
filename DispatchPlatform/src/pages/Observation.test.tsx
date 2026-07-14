import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import { activeTask, mockObservationEvents } from '../data/mockData';
import type { Language, NormalizedTaskStatus, RuntimeConfig } from '../types';
import { Observation } from './Observation';

function mockJson(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
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
  task?: NormalizedTaskStatus;
  language?: Language;
  runtimeOverrides?: Partial<RuntimeConfig>;
  onTaskStatusChange?: ReturnType<typeof vi.fn>;
};

function renderObservation(overrides: ObservationOverrides = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const renderPage = (nextOverrides: ObservationOverrides = {}) => {
    const merged = { ...overrides, ...nextOverrides };
    const runtimeConfig = resolveRuntimeConfig(merged.runtimeOverrides);
    const task = merged.task ?? activeTask;

    return (
      <QueryClientProvider client={client}>
        <Observation
          language={merged.language ?? 'en'}
          selectedSut={runtimeConfig.sutTargets[0]}
          activeTask={task}
          runtimeConfig={runtimeConfig}
          onTaskStatusChange={merged.onTaskStatusChange ?? vi.fn()}
        />
      </QueryClientProvider>
    );
  };
  const result = render(renderPage());

  return {
    ...result,
    client,
    rerenderObservation: (nextOverrides: ObservationOverrides = {}) => {
      result.rerender(renderPage(nextOverrides));
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Observation', () => {
  test('matches the approved Observe composition and source order without legacy log controls', async () => {
    mockTaskApi([activeTask]);

    const { container } = renderObservation({ language: 'zh' });

    const title = screen.getByRole('heading', { name: '执行观测' });
    const titleRow = title.closest('.page-header');
    expect(titleRow).not.toBeNull();
    expect(screen.getByText('以任务状态为准，清晰分离轮询进度、当前命令与最终日志。')).toBeInTheDocument();
    expect(within(titleRow as HTMLElement).getByText('执行中')).toBeInTheDocument();
    expect(within(titleRow as HTMLElement).getByRole('link', { name: '导出日志' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    const metrics = screen.getByRole('region', { name: '观测指标' });
    expect(within(metrics).getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      '任务状态',
      '命令进度',
      '已用时间',
      'Object'
    ]);
    expect(within(metrics).getByText(activeTask.task_id)).toBeInTheDocument();
    expect(within(metrics).getByText('2 / 5')).toBeInTheDocument();
    expect(within(metrics).getByText(/pytest testcase\/save/i)).toBeInTheDocument();

    const path = screen.getByRole('region', { name: '执行路径' });
    expect(within(path).getByText('状态每 5 秒刷新一次')).toBeInTheDocument();
    expect(within(path).getAllByRole('listitem')).toHaveLength(5);
    expect(within(path).getByText('环境检查')).toBeInTheDocument();
    expect(within(path).getByText('脚本准备')).toBeInTheDocument();
    expect(within(path).getByText('保存接口')).toBeInTheDocument();
    expect(within(path).getByText('查询接口')).toBeInTheDocument();
    expect(within(path).getByText('汇总')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Execution events' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '任务控制' })).toBeInTheDocument();
    const lowerGrid = container.querySelector('[data-testid="observation-lower-grid"]');
    expect(lowerGrid?.children).toHaveLength(2);
    expect(lowerGrid?.children[0]).toHaveClass('live-log-panel');
    expect(lowerGrid?.children[1]).toHaveClass('observation-control-card');

    expect(screen.queryByRole('button', { name: /暂停|继续|清空|全部日志级别|警告|错误/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/实时连接|正在连接|日志已完成/i)).not.toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/tasks/${activeTask.task_id}`,
      expect.any(Object)
    ));
  });

  test('uses a terminal task response for backend log export and propagates normalized status', async () => {
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
    expect(screen.getByRole('button', { name: /cancel task/i })).toBeDisabled();
    expect(onTaskStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', canExportLogs: true })
    );
  });

  test('polls active status at exactly five seconds and stops after a terminal response', async () => {
    vi.useFakeTimers();
    const runningEnvelope = {
      success: true,
      task: {
        id: activeTask.task_id,
        status: 'running',
        progress: 40,
        total_scripts: 5,
        executed_scripts: 2,
        failed_scripts: 0,
        queue_position: -1
      }
    };
    const terminalEnvelope = {
      success: true,
      task: {
        ...runningEnvelope.task,
        status: 'completed',
        progress: 100,
        executed_scripts: 5,
        log_dir: 'task_done',
        download_url: '/api/download/task_done/execution.log'
      }
    };
    const fetchSpy = mockTaskApi([runningEnvelope, terminalEnvelope]);

    const { client } = renderObservation();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(countStatusRequests(fetchSpy, activeTask.task_id)).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(countStatusRequests(fetchSpy, activeTask.task_id)).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(countStatusRequests(fetchSpy, activeTask.task_id)).toBe(2);
    expect(client.getQueryData(['task-status', '/api', activeTask.task_id])).toEqual(
      expect.objectContaining({
        source: 'live',
        task: expect.objectContaining({ status: 'success', canExportLogs: true })
      })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(countStatusRequests(fetchSpy, activeTask.task_id)).toBe(2);
  });

  test('requests cancellation, refetches, acknowledges it, and keeps status polling active', async () => {
    const runningEnvelope = {
      success: true,
      task: {
        id: activeTask.task_id,
        status: 'running',
        progress: 40,
        total_scripts: 5,
        executed_scripts: 2,
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

    await user.click(await screen.findByRole('button', { name: /cancel task/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(`/api/tasks/${activeTask.task_id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' }
      });
      expect(countStatusRequests(fetchSpy, activeTask.task_id)).toBe(2);
    });
    expect(screen.getByText(/cancellation requested/i)).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: /cancel task/i })).toBeDisabled();
    expect(screen.getAllByText(/running/i).length).toBeGreaterThan(0);
  });

  test('scopes cancellation acknowledgement to the task that requested it', async () => {
    const earlierTask = { ...activeTask, task_id: 'task_earlier_session' };
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

    await user.click(await screen.findByRole('button', { name: /cancel task/i }));
    expect(screen.getByText(/cancellation requested/i)).toHaveAttribute('role', 'status');

    rerenderObservation({ task: earlierTask });

    expect(await screen.findByRole('button', { name: /cancel task/i })).toBeEnabled();
  });

  test('keeps an unknown future task state neutral in the five visible path stages', async () => {
    const futureTask = {
      ...activeTask,
      status: 'future_stage',
      uiStatus: 'future_stage'
    } as unknown as NormalizedTaskStatus;
    mockTaskApi([futureTask]);

    renderObservation({ task: futureTask });

    const path = screen.getByRole('region', { name: 'Execution path' });
    expect(within(path).getAllByRole('listitem').map((stage) => stage.getAttribute('data-stage-state'))).toEqual([
      'neutral',
      'neutral',
      'neutral',
      'neutral',
      'neutral'
    ]);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  });

  test('does not claim status connectivity before the first request succeeds', async () => {
    let resolveStatus!: (response: Response) => void;
    const pendingStatus = new Promise<Response>((resolve) => {
      resolveStatus = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/logs')) {
        return mockJson({ success: true, total: 0, logs: [] });
      }
      return pendingStatus;
    });

    renderObservation();

    const control = screen.getByRole('region', { name: 'Task control' });
    const connection = within(control).getByRole('status');
    expect(connection).toHaveAttribute('aria-live', 'polite');
    expect(connection).toHaveTextContent('Refreshing');
    expect(connection).not.toHaveTextContent('Connected');

    resolveStatus(await mockJson(activeTask));

    await waitFor(() => expect(connection).toHaveTextContent('Connected'));
  });

  test('reactively discloses a status fallback after a successful live refresh', async () => {
    let statusRequestCount = 0;
    let resolveFallback!: (response: Response) => void;
    const pendingFallback = new Promise<Response>((resolve) => {
      resolveFallback = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/logs')) {
        return mockJson({ success: true, total: 0, logs: [] });
      }
      statusRequestCount += 1;
      return statusRequestCount === 1
        ? mockJson(activeTask)
        : pendingFallback;
    });

    const { client } = renderObservation({ runtimeOverrides: { enableMockFallback: true } });
    const control = screen.getByRole('region', { name: 'Task control' });
    const connection = within(control).getByRole('status');
    await waitFor(() => expect(connection).toHaveTextContent('Connected'));

    const refetch = client.refetchQueries({ queryKey: ['task-status'] });
    await waitFor(() => expect(connection).toHaveTextContent('Refreshing'));
    resolveFallback(await mockJson({ success: false, message: 'Unavailable' }, false, 503));
    await refetch;

    await waitFor(() => expect(connection).toHaveTextContent('Demo data'));
    expect(connection).not.toHaveTextContent('Connected');
  });

  test('supplies approved sample events only when mock fallback is explicitly enabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/logs')) {
        return mockJson({ success: false, message: 'Unavailable' }, false, 503);
      }
      return mockJson(activeTask);
    });

    const fallbackView = renderObservation({ runtimeOverrides: { enableMockFallback: true } });
    expect(await screen.findByText(mockObservationEvents[0].message)).toBeInTheDocument();
    expect(screen.getByText('LIVE STATUS · NOT LIVE LOGS')).toBeInTheDocument();
    fallbackView.unmount();

    renderObservation({ runtimeOverrides: { enableMockFallback: false } });
    expect(await screen.findByText('Logs unavailable')).toBeInTheDocument();
    expect(screen.queryByText(mockObservationEvents[0].message)).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE STATUS · NOT LIVE LOGS')).not.toBeInTheDocument();
  });

  test('renders a queued position without adding another title-row control', async () => {
    mockTaskApi([{
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
    }]);

    renderObservation();

    const metrics = screen.getByRole('region', { name: 'Observation metrics' });
    expect(await within(metrics).findByText(/queue position: 3/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observe' }).closest('.page-header')).not.toHaveTextContent(/queue position/i);
  });
});
