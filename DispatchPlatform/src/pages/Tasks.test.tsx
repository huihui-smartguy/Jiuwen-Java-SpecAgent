import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import type { Script, SutTarget, TaskCreateResponse } from '../types';
import { Tasks } from './Tasks';

const liveRuntimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: false });
const mockRuntimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
const selectedSut = liveRuntimeConfig.sutTargets[0];
const tasksStyles = readFileSync('src/styles/routes/tasks.css', 'utf8');

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
    const { container } = renderTasks();

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
    expect(objectSummary).not.toHaveTextContent(selectedSut.version);
    expect(within(objectSummary).getByRole('button', { name: '更换对象' })).toBeInTheDocument();

    const modeSelector = screen.getByRole('radiogroup', { name: '触发方式' });
    expect(within(modeSelector).getByRole('radio', { name: '按 Feature' })).toBeChecked();
    expect(within(modeSelector).getByRole('radio', { name: '按 Level' })).toBeInTheDocument();
    expect(within(modeSelector).getByRole('radio', { name: '选择脚本' })).toBeInTheDocument();
    expect(Array.from(modeSelector.querySelectorAll('label > span')).map((item) => item.textContent)).toEqual([
      'Feature',
      'Level',
      'Scripts',
    ]);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveValue('Save API'));
    expect(screen.getByLabelText('Execution profile')).toHaveValue('live-standard');

    expect(screen.getByRole('heading', { name: '脚本快照 · READ-ONLY SELECTION' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索脚本' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: '脚本快照' })).toBeInTheDocument();
    expect(await screen.findByText('save_api_test')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Launch summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '启动执行' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '执行护栏' })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: '脚本快照' })).getAllByRole('columnheader').map(
      (header) => header.textContent
    )).toEqual(['脚本', 'Feature', '级别', '路径']);
    expect(container.querySelector('.tasks-config-heading p')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-ready-pill > span')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-guardrail-count > span')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-script-search svg')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-launch-card .lucide-sparkles')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-level-pill')).not.toBeInTheDocument();

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
    expect(tasksStyles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-segmented\s*\{[^}]*height:\s*52px;/
    );
    expect(tasksStyles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-segmented label > span\s*\{[^}]*height:\s*44px;/
    );
    expect(tasksStyles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-table-scroll tbody tr\s*\{[^}]*height:\s*44px;/
    );
  });

  test('contains the script table scroller inside its card at every stacked breakpoint', () => {
    const compressedDesktopStart = tasksStyles.indexOf('@media (max-width: 1319px)');
    const stackedStart = tasksStyles.indexOf('@media (max-width: 1179px)');
    const tabletStart = tasksStyles.indexOf('@media (max-width: 980px)');

    expect(compressedDesktopStart).toBeGreaterThanOrEqual(0);
    expect(stackedStart).toBeGreaterThan(compressedDesktopStart);
    expect(tabletStart).toBeGreaterThan(stackedStart);
    expect(tasksStyles.slice(compressedDesktopStart, stackedStart)).toMatch(
      /\.tasks-table-scroll\s*\{[^}]*width:\s*auto;/
    );
    expect(tasksStyles.slice(stackedStart, tabletStart)).toMatch(
      /\.tasks-table-scroll\s*\{[^}]*width:\s*auto;/
    );
  });

  test('refetches discovery data when same-named Objects use different API endpoints', async () => {
    const firstTarget: SutTarget = {
      id: 'shared-one',
      name: 'Shared one',
      product: 'Shared Product',
      scene: 'API',
      version: 'v1',
      apiBaseUrl: '/api-one',
      status: 'healthy'
    };
    const secondTarget: SutTarget = {
      ...firstTarget,
      id: 'shared-two',
      name: 'Shared two',
      apiBaseUrl: '/api-two'
    };
    const runtimeConfig = resolveRuntimeConfig({
      defaultLanguage: 'zh',
      enableMockFallback: false,
      sutTargets: [firstTarget, secondTarget]
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/features')) {
        const featureName = url.pathname.startsWith('/api-two/') ? 'Endpoint B' : 'Endpoint A';
        return json({
          success: true,
          product: firstTarget.product,
          scene: firstTarget.scene,
          features: [{ id: featureName, name: featureName, type: 'L1' }],
          total: 1
        });
      }
      if (url.pathname.endsWith('/scripts')) {
        return json({ success: true, scripts: [], total: 0, filters: {} });
      }
      throw new Error(`unexpected request: ${url.toString()}`);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    function TargetHarness() {
      const [target, setTarget] = useState(firstTarget);
      return (
        <MemoryRouter initialEntries={['/tasks']}>
          <button type="button" onClick={() => setTarget(secondTarget)}>Switch endpoint</button>
          <Tasks
            language="zh"
            selectedSut={target}
            runtimeConfig={runtimeConfig}
            onTaskCreated={vi.fn()}
            onRequestObjectChange={vi.fn()}
          />
        </MemoryRouter>
      );
    }

    render(
      <QueryClientProvider client={client}>
        <TargetHarness />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveValue('Endpoint A'));
    await userEvent.click(screen.getByRole('button', { name: 'Switch endpoint' }));
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => (
      new URL(String(input), 'http://local.test').pathname === '/api-two/features'
    ))).toBe(true));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveValue('Endpoint B'));
  });

  test('encodes the exact approved desktop Tasks geometry', () => {
    expect(tasksStyles).toMatch(/\.tasks-page \.page-header\s*\{[^}]*height:\s*118px;[^}]*min-height:\s*118px;[^}]*margin-bottom:\s*24px;/s);
    expect(tasksStyles).toMatch(/\.tasks-create-task\s*\{[^}]*width:\s*142px;[^}]*height:\s*52px;/s);
    expect(tasksStyles).toMatch(/\.tasks-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*856px\) minmax\(0,\s*416px\);[^}]*gap:\s*24px;/s);
    expect(tasksStyles).toMatch(/\.tasks-left-column\s*\{[^}]*grid-template-rows:\s*340px 356px;[^}]*gap:\s*24px;/s);
    expect(tasksStyles).toMatch(/\.tasks-right-rail\s*\{[^}]*grid-template-rows:\s*330px 366px;[^}]*gap:\s*24px;/s);
    expect(tasksStyles).toMatch(/\.tasks-config-card\s*\{[^}]*height:\s*340px;[^}]*padding:\s*24px 28px;/s);
    expect(tasksStyles).toMatch(/\.tasks-steps\s*\{[^}]*height:\s*52px;[^}]*grid-template-columns:\s*repeat\(3,\s*260px\);[^}]*gap:\s*10px;/s);
    expect(tasksStyles).toMatch(/\.tasks-object-summary\s*\{[^}]*height:\s*52px;[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
    expect(tasksStyles).toMatch(/\.tasks-segmented\s*\{[^}]*width:\s*330px;[^}]*height:\s*44px;[^}]*border-radius:\s*14px;/s);
    expect(tasksStyles).toMatch(/\.tasks-fields\s*\{[^}]*height:\s*48px;[^}]*gap:\s*12px;/s);
    expect(tasksStyles).toMatch(/\.tasks-snapshot-card\s*\{[^}]*height:\s*356px;/s);
    expect(tasksStyles).toMatch(/\.tasks-script-search\s*\{[^}]*width:\s*330px;[^}]*height:\s*44px;/s);
    expect(tasksStyles).toMatch(/\.tasks-table-scroll th\s*\{[^}]*height:\s*44px;/s);
    expect(tasksStyles).toMatch(/\.tasks-table-scroll td\s*\{[^}]*height:\s*68px;/s);
    expect(tasksStyles).toMatch(/\.tasks-launch-card\s*\{[^}]*height:\s*330px;/s);
    expect(tasksStyles).toMatch(/\.tasks-guardrail-card\s*\{[^}]*height:\s*366px;/s);
    expect(tasksStyles).toMatch(/\.tasks-guardrail-list > div\s*\{[^}]*height:\s*80px;/s);
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
    await waitFor(() => expect(screen.getByTestId('location-path')).toHaveTextContent('/observation'));
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
    await user.selectOptions(screen.getByRole('combobox', { name: 'Level' }), 'L1');
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
