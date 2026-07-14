import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import type { Script, TaskCreateResponse } from '../types';
import { Tasks } from './Tasks';

const liveRuntimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: false });
const mockRuntimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
const selectedSut = liveRuntimeConfig.sutTargets[0];

const scripts: Script[] = [
  {
    id: 'save-script',
    name: 'save_api_test',
    filename: 'save_api_test.py',
    extension: '.py',
    product: selectedSut.product,
    scene: selectedSut.scene,
    feature: 'Save API',
    level: 'L1',
    size: 42,
    path: 'api/keys/save.py'
  },
  {
    id: 'list-script',
    name: 'list_api_keys_test',
    filename: 'list_api_keys_test.py',
    extension: '.py',
    product: selectedSut.product,
    scene: selectedSut.scene,
    feature: 'Save API',
    level: 'L1',
    size: 38,
    path: 'api/keys/list.py'
  }
];

function json(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  } as Response);
}

function mockTaskApi(options: {
  scripts?: Script[];
  taskId?: string;
  triggerType?: 'feature' | 'level' | 'scripts';
} = {}) {
  const availableScripts = options.scripts ?? scripts;
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input), 'http://local.test');
    if (url.pathname.endsWith('/features')) {
      return json({
        success: true,
        product: selectedSut.product,
        scene: selectedSut.scene,
        features: [{ id: 'save', name: 'Save API', type: 'L1' }],
        total: 1
      });
    }
    if (url.pathname.endsWith('/scripts')) {
      return json({
        success: true,
        scripts: availableScripts,
        total: availableScripts.length,
        filters: {
          product: url.searchParams.get('product'),
          scene: url.searchParams.get('scene'),
          feature: url.searchParams.get('feature'),
          level: url.searchParams.get('level')
        }
      });
    }
    if (url.pathname.endsWith('/tasks') && init?.method === 'POST') {
      return json({
        success: true,
        task_id: options.taskId ?? 'task_created',
        status: 'pending',
        trigger_type: options.triggerType ?? 'feature',
        message: 'created',
        created_at: '2026-07-14T10:00:00Z',
        estimated_duration: '6 min',
        queue_position: 1,
        total_scripts: availableScripts.length
      });
    }
    throw new Error(`unexpected request: ${url.toString()}`);
  });
}

function LocationProbe() {
  return <output data-testid="location-path">{useLocation().pathname}</output>;
}

function renderTasks(options: {
  runtimeConfig?: typeof liveRuntimeConfig;
  onTaskCreated?: (task: TaskCreateResponse) => void;
  onRequestObjectChange?: () => void;
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const props = {
    language: 'zh',
    selectedSut,
    runtimeConfig: options.runtimeConfig ?? liveRuntimeConfig,
    onTaskCreated: options.onTaskCreated ?? vi.fn(),
    onRequestObjectChange: options.onRequestObjectChange ?? vi.fn()
  };

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tasks']}>
        <Routes>
          <Route
            path="/tasks"
            element={(
              <>
                <Tasks {...props} />
                <LocationProbe />
              </>
            )}
          />
          <Route path="/observation" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function postPayload(fetchSpy: ReturnType<typeof mockTaskApi>) {
  const call = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');
  return JSON.parse(String(call?.[1]?.body));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('approved Tasks composition', () => {
  test('renders the permanent one-page hierarchy and removes the queue, tabs, and wizard UI', async () => {
    mockTaskApi();
    renderTasks();

    expect(screen.getByRole('heading', { level: 1, name: '任务调度' })).toBeInTheDocument();
    expect(screen.getByText('从测试对象到脚本范围，用清晰的三步流程发起可靠执行。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建任务' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '配置新任务' })).toBeInTheDocument();

    const steps = screen.getByRole('list', { name: '任务配置步骤' });
    expect(within(steps).getByText('Object')).toBeInTheDocument();
    expect(within(steps).getByText('Trigger')).toBeInTheDocument();
    expect(within(steps).getByText('Scope')).toBeInTheDocument();

    const objectSummary = screen.getByTestId('task-context-summary');
    expect(objectSummary).toHaveTextContent(selectedSut.product);
    expect(objectSummary).toHaveTextContent(selectedSut.scene);
    expect(objectSummary).toHaveTextContent(selectedSut.version);
    expect(within(objectSummary).getByRole('button', { name: '更换对象' })).toBeInTheDocument();

    const modeSelector = screen.getByRole('radiogroup', { name: '触发方式' });
    expect(within(modeSelector).getByRole('radio', { name: '按 Feature' })).toBeChecked();
    expect(within(modeSelector).getByRole('radio', { name: '按 Level' })).toBeInTheDocument();
    expect(within(modeSelector).getByRole('radio', { name: '选择脚本' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Feature')).toHaveValue('Save API'));
    expect(screen.getByLabelText('Execution profile')).toHaveValue('live-standard');

    expect(screen.getByRole('heading', { name: '脚本快照' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索脚本' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: '脚本快照' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Launch summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '启动执行' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '执行护栏' })).toBeInTheDocument();

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/任务队列|本次会话/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /上一步|下一步/ })).not.toBeInTheDocument();
  });

  test('the page action focuses the first configuration control and change Object delegates to the shell', async () => {
    const user = userEvent.setup();
    const onRequestObjectChange = vi.fn();
    mockTaskApi();
    renderTasks({ onRequestObjectChange });

    const firstControl = screen.getByRole('radio', { name: '按 Feature' });
    await user.click(screen.getByRole('button', { name: '创建任务' }));
    expect(firstControl).toHaveFocus();

    await user.click(screen.getByRole('button', { name: '更换对象' }));
    expect(onRequestObjectChange).toHaveBeenCalledTimes(1);
  });

  test('filters the fetched script snapshot locally without issuing a search request', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockTaskApi();
    renderTasks();

    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => {
      const url = new URL(String(input), 'http://local.test');
      return url.pathname.endsWith('/scripts') && url.searchParams.get('feature') === 'Save API';
    })).toBe(true));
    await waitFor(() => {
      expect(screen.getByText('save_api_test')).toBeInTheDocument();
      expect(screen.getByText('list_api_keys_test')).toBeInTheDocument();
    });
    const scriptRequestsBeforeSearch = fetchSpy.mock.calls.filter(([input]) => (
      new URL(String(input), 'http://local.test').pathname.endsWith('/scripts')
    )).length;

    await user.type(screen.getByRole('searchbox', { name: '搜索脚本' }), 'list');

    expect(screen.queryByText('save_api_test')).not.toBeInTheDocument();
    expect(screen.getByText('list_api_keys_test')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([input]) => (
      new URL(String(input), 'http://local.test').pathname.endsWith('/scripts')
    ))).toHaveLength(scriptRequestsBeforeSearch);
  });

  test('shows mock-only credential and estimate values only when fallback mode is enabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    renderTasks({ runtimeConfig: mockRuntimeConfig });

    expect(screen.getByText('~ 6 min')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('3 / 3')).toBeInTheDocument());
    const credentials = screen.getByTestId('guardrail-credentials');
    expect(credentials).toHaveTextContent('凭据有效');
    expect(credentials).toHaveTextContent('Passed');
  });

  test('keeps unsupported credential and estimate claims unverified in live mode', async () => {
    mockTaskApi();
    renderTasks();

    expect(screen.getByText('Not verified')).toBeInTheDocument();
    expect(screen.getByTestId('launch-estimate')).toHaveTextContent('—');
    await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument());
  });

  test('keeps responsive segmented choices and selectable rows at least 44px tall', () => {
    const tasksCss = readFileSync('src/styles/routes/tasks.css', 'utf8');

    expect(tasksCss).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-segmented\s*\{[^}]*height:\s*52px;/
    );
    expect(tasksCss).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-segmented label > span\s*\{[^}]*height:\s*44px;/
    );
    expect(tasksCss).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-table-scroll tbody tr\s*\{[^}]*height:\s*44px;/
    );
  });
});

describe('task creation contracts', () => {
  test('creates by Feature with only the documented request fields and navigates to Observe', async () => {
    const user = userEvent.setup();
    const onTaskCreated = vi.fn();
    const fetchSpy = mockTaskApi({ taskId: 'task_feature', triggerType: 'feature' });
    renderTasks({ onTaskCreated });

    await user.click(await screen.findByRole('button', { name: '启动执行' }));

    await waitFor(() => expect(onTaskCreated).toHaveBeenCalledTimes(1));
    expect(postPayload(fetchSpy)).toEqual({
      product: selectedSut.product,
      scene: selectedSut.scene,
      feature: 'Save API'
    });
    expect(screen.getByTestId('location-path')).toHaveTextContent('/observation');
    expect(fetchSpy.mock.calls.some(([input]) => {
      const url = new URL(String(input), 'http://local.test');
      return url.pathname.endsWith('/features') &&
        url.searchParams.get('product') === selectedSut.product &&
        url.searchParams.get('scene') === selectedSut.scene;
    })).toBe(true);
  });

  test('creates by Level with the exact level payload', async () => {
    const user = userEvent.setup();
    const onTaskCreated = vi.fn();
    const fetchSpy = mockTaskApi({ taskId: 'task_level', triggerType: 'level' });
    renderTasks({ onTaskCreated });

    await user.click(screen.getByRole('radio', { name: '按 Level' }));
    await user.selectOptions(screen.getByLabelText('Level'), 'L1');
    await user.click(screen.getByRole('button', { name: '启动执行' }));

    await waitFor(() => expect(onTaskCreated).toHaveBeenCalledTimes(1));
    expect(postPayload(fetchSpy)).toEqual({
      product: selectedSut.product,
      scene: selectedSut.scene,
      level: 'L1'
    });
  });

  test('uses keyboard-selectable script rows backed by hidden checkboxes for the exact scripts payload', async () => {
    const user = userEvent.setup();
    const onTaskCreated = vi.fn();
    const fetchSpy = mockTaskApi({ taskId: 'task_scripts', triggerType: 'scripts' });
    renderTasks({ onTaskCreated });

    await user.click(screen.getByRole('radio', { name: '选择脚本' }));
    const row = await screen.findByRole('row', { name: /save_api_test/ });
    const checkbox = within(row).getByRole('checkbox', { name: '选择 save_api_test' });
    expect(checkbox).toHaveClass('sr-only');
    expect(within(screen.getByRole('table', { name: '脚本快照' })).getAllByRole('columnheader')).toHaveLength(4);

    row.focus();
    await user.keyboard(' ');
    expect(checkbox).toBeChecked();
    expect(row).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: '启动执行' }));

    await waitFor(() => expect(onTaskCreated).toHaveBeenCalledTimes(1));
    expect(postPayload(fetchSpy)).toEqual({
      product: selectedSut.product,
      scene: selectedSut.scene,
      feature: 'Save API',
      script_name: ['save_api_test']
    });
  });
});
