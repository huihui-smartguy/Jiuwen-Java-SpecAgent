import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import { activeTask, mockObservationEvents } from '../data/mockData';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';
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
  cancellationResponses: unknown[] = [],
  scriptStatusResponses: unknown[] = []
) {
  let statusIndex = 0;
  let cancellationIndex = 0;
  let scriptStatusIndex = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/logs')) {
      return mockJson({ success: true, total: 0, logs: [] });
    }
    if (url.endsWith('/script-status')) {
      const response = scriptStatusResponses[
        Math.min(scriptStatusIndex, scriptStatusResponses.length - 1)
      ];
      scriptStatusIndex += 1;
      return mockJson(response);
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

function countScriptStatusRequests(fetchSpy: ReturnType<typeof vi.spyOn>, taskId: string) {
  return fetchSpy.mock.calls.filter(([input]) => (
    String(input) === `/api/tasks/${taskId}/script-status`
  )).length;
}

type ObservationOverrides = {
  task?: NormalizedTaskStatus;
  language?: Language;
  runtimeOverrides?: Partial<RuntimeConfig>;
  selectedSut?: SutTarget;
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
          selectedSut={merged.selectedSut ?? runtimeConfig.sutTargets[0]}
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
  test('keeps polling, logs, cancellation, and Object identity bound to the task origin', async () => {
    const user = userEvent.setup();
    const originSut: SutTarget = {
      id: 'origin-object',
      name: 'Origin Object',
      product: 'Origin product',
      scene: 'API',
      version: 'v1',
      apiBaseUrl: '/origin-api',
      status: 'healthy'
    };
    const newlySelectedSut: SutTarget = {
      id: 'new-object',
      name: 'New Object',
      product: 'New product',
      scene: 'API',
      version: 'v2',
      apiBaseUrl: '/new-api',
      status: 'healthy'
    };
    const originTask = {
      ...activeTask,
      sourceSut: originSut
    } as NormalizedTaskStatus & { sourceSut: SutTarget };
    const fetchSpy = mockTaskApi([activeTask], [{
      success: true,
      task_id: activeTask.task_id,
      message: 'Cancellation requested'
    }]);

    renderObservation({
      task: originTask,
      selectedSut: newlySelectedSut,
      runtimeOverrides: {
        enableMockFallback: false,
        sutTargets: [originSut, newlySelectedSut]
      }
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      `/origin-api/tasks/${activeTask.task_id}`,
      expect.any(Object)
    ));
    expect(screen.getByText('Origin Object')).toBeInTheDocument();
    expect(screen.queryByText('New Object')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel task/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      `/origin-api/tasks/${activeTask.task_id}`,
      expect.objectContaining({ method: 'DELETE' })
    ));
    expect(fetchSpy.mock.calls.some(([input]) => String(input).startsWith('/new-api/tasks/'))).toBe(false);
  });

  test('owns the approved Observe desktop geometry from hero through the lower grid', async () => {
    mockTaskApi([activeTask]);

    const { container } = renderObservation();
    const page = container.querySelector('.observation-page');
    const header = container.querySelector('.page-header');
    const metrics = container.querySelector('.observation-metrics');
    const observeCss = readFileSync('src/styles/routes/observe.css', 'utf8');

    expect(page?.firstElementChild).toBe(header);
    expect(header?.nextElementSibling).toBe(metrics);
    expect(observeCss).toMatch(
      /\.observation-page\s*>\s*\.page-header\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*112px;[^}]*margin-bottom:\s*24px;/
    );
    expect(observeCss).toMatch(
      /\.observation-metrics\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*144px;[^}]*gap:\s*16px;[^}]*margin-bottom:\s*24px;/
    );
    expect(observeCss).toMatch(
      /\.observation-path-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*192px;[^}]*margin-bottom:\s*24px;/
    );
    expect(observeCss).toMatch(
      /\.observation-lower-grid\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*400px;[^}]*grid-template-columns:\s*856px 416px;[^}]*gap:\s*24px;/
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  });

  test('releases the fixed desktop header rail before the responsive content narrows', () => {
    const observeCss = readFileSync('src/styles/routes/observe.css', 'utf8');

    expect(observeCss).toMatch(
      /@media \(max-width:\s*1319px\)[\s\S]*?\.observation-page\s*>\s*\.page-header\s*>\s*div:first-child\s*\{[^}]*width:\s*auto;[^}]*min-width:\s*0;[^}]*flex:\s*1\s+1\s+auto;/
    );
    expect(observeCss).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*?\.observation-page\s*>\s*\.page-header\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*118px;/
    );
  });

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
    expect(within(metrics).getByText(`…${activeTask.task_id.slice(-6)}`)).toBeInTheDocument();
    expect(within(metrics).getByText('2 / 5')).toBeInTheDocument();
    expect(within(metrics).getByText(/pytest testcase\/save/i)).toBeInTheDocument();
    expect(metrics.querySelector('svg')).toBeNull();
    expect(titleRow?.querySelector('.observation-header-actions svg')).toBeNull();

    const path = screen.getByRole('region', { name: '执行路径' });
    expect(within(path).getByText('状态每 5 秒刷新一次')).toBeInTheDocument();
    expect(within(path).getAllByRole('listitem')).toHaveLength(5);
    expect(within(path).getByText('环境检查')).toBeInTheDocument();
    expect(within(path).getByText('脚本准备')).toBeInTheDocument();
    expect(within(path).getByText('保存 API')).toBeInTheDocument();
    expect(within(path).getByText('查询 API')).toBeInTheDocument();
    expect(within(path).getByText('汇总')).toBeInTheDocument();
    expect(within(path).getAllByText('等待中')).toHaveLength(2);
    expect(path.querySelector('.observation-path-list__track')).toBeNull();

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
    expect(screen.getByText(/current subprocess finishes first/i)).toBeInTheDocument();
  });

  test('confirms cancellation only after the authoritative task endpoint returns cancelled', async () => {
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
    const cancelledEnvelope = {
      success: true,
      task: {
        ...runningEnvelope.task,
        status: 'cancelled',
        progress: 40,
        completed_at: '2026-07-20T10:00:00'
      }
    };
    mockTaskApi(
      [runningEnvelope, cancelledEnvelope],
      [{
        success: true,
        task_id: activeTask.task_id,
        previous_status: 'running',
        message: 'Cancellation signal sent'
      }]
    );

    renderObservation();
    await userEvent.click(await screen.findByRole('button', { name: /cancel task/i }));

    expect(await screen.findByText('Cancellation confirmed by the executor.')).toHaveAttribute('role', 'status');
    expect(screen.queryByText(/cancellation requested\. waiting/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel task/i })).toBeDisabled();
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });

  test.each([
    ['completed', 'Success'],
    ['failed', 'Failed']
  ] as const)(
    'clears a pending cancellation acknowledgement when the task instead reaches %s',
    async (terminalStatus, expectedLabel) => {
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
          status: terminalStatus,
          progress: 100,
          executed_scripts: 5,
          failed_scripts: terminalStatus === 'failed' ? 1 : 0,
          completed_at: '2026-07-20T10:00:00'
        }
      };
      mockTaskApi(
        [runningEnvelope, terminalEnvelope],
        [{
          success: true,
          task_id: activeTask.task_id,
          previous_status: 'running',
          message: 'Cancellation signal sent'
        }]
      );

      renderObservation();
      await userEvent.click(await screen.findByRole('button', { name: /cancel task/i }));

      await waitFor(() => expect(screen.getAllByText(expectedLabel).length).toBeGreaterThan(0));
      expect(screen.queryByText(/cancellation requested\. waiting/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Cancellation confirmed by the executor.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel task/i })).toBeDisabled();
    }
  );

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
    const latestLiveSnapshot = {
      ...activeTask,
      progress: {
        ...activeTask.progress,
        total_commands: 7,
        completed: 4,
        failed: 1
      }
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/logs')) {
        return mockJson({ success: true, total: 0, logs: [] });
      }
      statusRequestCount += 1;
      return statusRequestCount === 1
        ? mockJson(latestLiveSnapshot)
        : pendingFallback;
    });

    const { client } = renderObservation({ runtimeOverrides: { enableMockFallback: true } });
    const control = screen.getByRole('region', { name: 'Task control' });
    const connection = within(control).getByRole('status');
    await waitFor(() => expect(connection).toHaveTextContent('Connected'));
    expect(screen.getByText('4 / 7')).toBeInTheDocument();

    const refetch = client.refetchQueries({ queryKey: ['task-status'] });
    await waitFor(() => expect(connection).toHaveTextContent('Refreshing'));
    resolveFallback(await mockJson({ success: false, message: 'Unavailable' }, false, 503));
    await refetch;

    await waitFor(() => expect(connection).toHaveTextContent('Demo data'));
    expect(connection).not.toHaveTextContent('Connected');
    expect(screen.getByText('4 / 7')).toBeInTheDocument();
  });

  test('retains the last valid task snapshot when a later status refresh fails', async () => {
    let statusRequestCount = 0;
    const liveSnapshot = {
      success: true,
      task: {
        id: activeTask.task_id,
        status: 'running',
        progress: 57,
        total_scripts: 7,
        executed_scripts: 4,
        failed_scripts: 1,
        queue_position: -1,
        version: 'release2'
      }
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/logs')) {
        return mockJson({ success: true, total: 0, logs: [] });
      }
      statusRequestCount += 1;
      return statusRequestCount === 1
        ? mockJson(liveSnapshot)
        : mockJson({ success: false, message: 'Status unavailable' }, false, 503);
    });

    const { client } = renderObservation({ runtimeOverrides: { enableMockFallback: false } });
    expect(await screen.findByText('4 / 7')).toBeInTheDocument();
    expect(screen.getByText('release2')).toBeInTheDocument();

    await act(async () => {
      await client.refetchQueries({ queryKey: ['task-status'] });
    });

    expect(await screen.findByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByText('4 / 7')).toBeInTheDocument();
    expect(screen.getByText('release2')).toBeInTheDocument();
    expect(screen.getByText(/most recent task information is retained/i)).toBeInTheDocument();
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

  test('shows the selected execution version and opens a keyboard-accessible case-status drawer', async () => {
    const user = userEvent.setup();
    const task = { ...activeTask, version: 'release1' };
    const { version: _omittedVersion, ...statusWithoutVersion } = task;
    const fetchSpy = mockTaskApi([statusWithoutVersion], [], [{
      success: true,
      task_id: task.task_id,
      scripts_status: [
        {
          script_id: 'script-save',
          script_name: 'save_api_test',
          version: 'release1',
          status: 'pass',
          started_at: '2026-07-15T09:00:00Z',
          completed_at: '2026-07-15T09:00:04Z',
          duration_seconds: 4,
          error_message: null
        },
        {
          script_id: 'script-query',
          script_name: 'query_api_test',
          version: 'release1',
          status: 'running',
          started_at: '2026-07-15T09:00:04Z',
          completed_at: null,
          duration_seconds: null,
          error_message: null
        }
      ],
      summary: { todo_count: 0, pass_count: 1, failed_count: 0, running_count: 1 }
    }]);

    renderObservation({ task });

    const control = screen.getByRole('region', { name: 'Task control' });
    await waitFor(() => expect(within(control).getByRole('status')).toHaveTextContent('Connected'));
    expect(within(control).getByText('Execution version')).toBeInTheDocument();
    expect(within(control).getByText('release1')).toBeInTheDocument();
    const trigger = within(control).getByRole('button', { name: 'View case status' });
    await user.click(trigger);

    const drawer = await screen.findByRole('dialog', { name: 'Case status' });
    expect(fetchSpy).toHaveBeenCalledWith(`/api/tasks/${task.task_id}/script-status`, {
      headers: { Accept: 'application/json' }
    });
    expect(within(drawer).getByText('save_api_test')).toBeInTheDocument();
    expect(within(drawer).getByText('query_api_test')).toBeInTheDocument();
    expect(within(drawer).getByText('1 passed · 1 running · 0 failed · 3 pending')).toBeInTheDocument();
    const closeButton = within(drawer).getByRole('button', { name: 'Close case status' });
    expect(closeButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Case status' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('polls case status every two seconds only while its drawer is open and never promotes it to task authority', async () => {
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
    const scriptSnapshot = {
      success: true,
      task_id: activeTask.task_id,
      scripts_status: [
        {
          script_id: 'script-save',
          script_name: 'save_api_test',
          version: 'release1',
          status: 'pass',
          started_at: '2026-07-20T09:00:00Z',
          completed_at: '2026-07-20T09:00:01Z',
          duration_seconds: 1,
          error_message: null
        },
        {
          script_id: 'script-query',
          script_name: 'query_api_test',
          version: 'release1',
          status: 'pass',
          started_at: '2026-07-20T09:00:01Z',
          completed_at: '2026-07-20T09:00:02Z',
          duration_seconds: 1,
          error_message: null
        }
      ],
      summary: { todo_count: 99, pass_count: 2, failed_count: 0, running_count: 0 }
    };
    const fetchSpy = mockTaskApi([runningEnvelope], [], [scriptSnapshot]);

    renderObservation();
    fireEvent.click(screen.getByRole('button', { name: 'View case status' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(countScriptStatusRequests(fetchSpy, activeTask.task_id)).toBe(1);
    const drawer = screen.getByRole('dialog', { name: 'Case status' });
    expect(within(drawer).getByText('2 passed · 0 running · 0 failed · 3 pending')).toBeInTheDocument();
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /cancel task/i })).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(countScriptStatusRequests(fetchSpy, activeTask.task_id)).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(countScriptStatusRequests(fetchSpy, activeTask.task_id)).toBe(2);

    fireEvent.click(within(drawer).getByRole('button', { name: 'Close case status' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(countScriptStatusRequests(fetchSpy, activeTask.task_id)).toBe(2);
  });

  test('does not poll case status after the parent task reaches a terminal state', async () => {
    vi.useFakeTimers();
    const task: NormalizedTaskStatus = {
      ...activeTask,
      status: 'success',
      uiStatus: 'success',
      isTerminal: true,
      version: 'release1'
    };
    const fetchSpy = mockTaskApi([task], [], [{
      success: true,
      task_id: task.task_id,
      scripts_status: [],
      summary: { todo_count: 0, pass_count: 0, failed_count: 0, running_count: 0 }
    }]);

    renderObservation({ task });
    fireEvent.click(screen.getByRole('button', { name: 'View case status' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(countScriptStatusRequests(fetchSpy, task.task_id)).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(countScriptStatusRequests(fetchSpy, task.task_id)).toBe(1);
  });
});
