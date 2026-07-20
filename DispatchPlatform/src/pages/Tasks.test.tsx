import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import type { Feature, Language, Script, SutTarget, TaskCreateResponse } from '../types';
import { Tasks } from './Tasks';

const liveRuntimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: false });
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
  features?: Feature[];
  scripts?: Script[];
  scriptsByFeature?: Record<string, Script[]>;
  taskId?: string;
  triggerType?: 'feature' | 'level' | 'scripts' | 'scene';
} = {}) {
  const availableScripts = options.scripts ?? scripts;
  const availableFeatures = options.features ?? [{ id: 'save', name: 'Save API', type: 'L1' }];
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input), 'http://local.test');
    if (url.pathname.endsWith('/versions')) {
      return json({
        success: true,
        default_version: 'release1',
        versions: [
          {
            code: 'release1',
            name: 'Release 1',
            description: 'Stable test batch',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          },
          {
            code: 'release2',
            name: 'Release 2',
            description: 'Candidate test batch',
            created_at: '2026-07-10T00:00:00Z',
            is_default: false
          }
        ]
      });
    }
    if (url.pathname.endsWith('/features')) {
      return json({
        success: true,
        product: selectedSut.product,
        scene: selectedSut.scene,
        features: availableFeatures,
        total: availableFeatures.length
      });
    }
    if (url.pathname.endsWith('/scripts')) {
      const feature = url.searchParams.get('feature');
      const scopedScripts = feature && options.scriptsByFeature
        ? options.scriptsByFeature[feature] ?? []
        : availableScripts;
      return json({
        success: true,
        scripts: scopedScripts,
        total: scopedScripts.length,
        filters: {
          product: url.searchParams.get('product'),
          scene: url.searchParams.get('scene'),
          feature,
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
  const location = useLocation();
  const launch = (location.state as {
    testwiseLaunch?: { taskId?: string; apiBaseUrl?: string };
  } | null)?.testwiseLaunch;
  return (
    <output data-testid="location-path">
      {location.pathname}
      {launch ? `|${launch.taskId}|${launch.apiBaseUrl}` : ''}
    </output>
  );
}

function renderTasks(options: {
  language?: Language;
  runtimeConfig?: typeof liveRuntimeConfig;
  onTaskCreated?: (task: TaskCreateResponse) => void;
  onRequestObjectChange?: () => void;
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const props = {
    language: options.language ?? 'zh',
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

describe('approved R8 Tasks composition', () => {
  test('renders the permanent one-page hierarchy and removes the queue, tabs, and wizard UI', async () => {
    mockTaskApi();
    const { container } = renderTasks();

    expect(screen.getByRole('heading', { level: 1, name: '任务调度' })).toBeInTheDocument();
    expect(screen.getByText('从测试对象到脚本范围，用清晰的三步流程发起可靠执行。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建任务' })).not.toBeInTheDocument();
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
    expect(within(modeSelector).getByRole('radio', { name: '整个场景' })).toBeInTheDocument();
    expect(Array.from(modeSelector.querySelectorAll('label > span')).map((item) => item.textContent)).toEqual([
      'Feature',
      'Level',
      'Scripts',
      'Scene',
    ]);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveValue('Save API'));
    await waitFor(() => expect(screen.getByLabelText('执行版本')).toHaveValue('release1'));

    expect(screen.getByRole('heading', { name: '脚本快照 · READ-ONLY SELECTION' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索脚本' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: '脚本快照' })).toBeInTheDocument();
    expect(await screen.findByText('save_api_test')).toBeInTheDocument();
    const launchSummary = screen.getByRole('region', { name: '启动摘要' });
    expect(within(launchSummary).getByText('测试对象')).toBeInTheDocument();
    expect(within(launchSummary).getByText('触发方式')).toBeInTheDocument();
    expect(within(launchSummary).getByText('执行配置')).toBeInTheDocument();
    expect(within(launchSummary).getByText('执行与报告版本')).toBeInTheDocument();
    expect(within(launchSummary).getByText('版本来源')).toBeInTheDocument();
    expect(within(launchSummary).getByText('脚本数量')).toBeInTheDocument();
    expect(within(launchSummary).getByText('预计耗时')).toBeInTheDocument();
    expect(within(launchSummary).getByText('准备状态')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '启动执行' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '执行护栏' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: '脚本快照' })).getAllByRole('columnheader').map(
      (header) => header.textContent
    )).toEqual(['脚本', 'Feature', '级别', '路径']);
    expect(container.querySelector('.tasks-config-heading p')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-ready-pill > span')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-guardrail-card')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-script-search svg')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-launch-card .lucide-sparkles')).not.toBeInTheDocument();
    expect(container.querySelector('.tasks-level-pill')).not.toBeInTheDocument();

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/任务队列|本次会话/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /上一步|下一步/ })).not.toBeInTheDocument();
  });

  test('removes the inert page action while Change Object still delegates to the shell', async () => {
    const user = userEvent.setup();
    const onRequestObjectChange = vi.fn();
    mockTaskApi();
    renderTasks({ onRequestObjectChange });

    expect(screen.queryByRole('button', { name: '创建任务' })).not.toBeInTheDocument();

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

  test('aggregates exact feature scopes for the entire scene and stably deduplicates scripts', async () => {
    const user = userEvent.setup();
    const shared: Script = { ...scripts[0], id: 'shared-script', name: 'shared_from_feature_a' };
    const featureAOnly: Script = {
      ...scripts[0],
      id: 'feature-a-only',
      name: 'feature_a_only',
      path: 'api/a.py'
    };
    const duplicateFromB: Script = {
      ...shared,
      name: 'duplicate_from_feature_b',
      feature: 'Feature B'
    };
    const featureBOnly: Script = {
      ...scripts[0],
      id: 'feature-b-only',
      name: 'feature_b_only',
      feature: 'Feature B',
      path: 'api/b.py'
    };
    const fetchSpy = mockTaskApi({
      features: [
        { id: 'feature-a', name: 'Feature A', type: 'L1' },
        { id: 'feature-b', name: 'Feature B', type: 'L2' }
      ],
      scripts: [shared, featureAOnly, featureBOnly],
      scriptsByFeature: {
        'Feature A': [shared, featureAOnly],
        'Feature B': [duplicateFromB, featureBOnly]
      }
    });
    renderTasks();

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveValue('Feature A'));
    await user.click(screen.getByRole('radio', { name: '整个场景' }));

    const table = screen.getByRole('table', { name: '脚本快照' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4));
    expect(within(table).getByText('shared_from_feature_a')).toBeInTheDocument();
    expect(within(table).getByText('feature_a_only')).toBeInTheDocument();
    expect(within(table).getByText('feature_b_only')).toBeInTheDocument();
    expect(within(table).queryByText('duplicate_from_feature_b')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchSpy.mock.calls.filter(([input]) => (
      new URL(String(input), 'http://local.test').pathname.endsWith('/scripts')
    )).map(([input]) => (
      new URL(String(input), 'http://local.test').searchParams.get('feature')
    ))).toEqual(['Feature A', 'Feature A', 'Feature B']));
  });

  test('shows an empty snapshot and never requests unfiltered scripts when discovery returns no features', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockTaskApi({ features: [] });
    renderTasks();

    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => (
      new URL(String(input), 'http://local.test').pathname.endsWith('/features')
    ))).toBe(true));
    await user.click(screen.getByRole('radio', { name: '整个场景' }));

    const table = screen.getByRole('table', { name: '脚本快照' });
    expect(within(table).getByText('没有匹配的脚本')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([input]) => (
      new URL(String(input), 'http://local.test').pathname.endsWith('/scripts')
    ))).toBe(false);
  });

  test('localizes the complete Chinese launch summary without unsupported guardrail claims', async () => {
    mockTaskApi();
    renderTasks();

    const summary = screen.getByRole('region', { name: '启动摘要' });
    await waitFor(() => expect(within(summary).getByTestId('launch-estimate')).toHaveTextContent('约 3–5 分钟'));
    expect(within(summary).getByText('实时 · 标准')).toBeInTheDocument();
    expect(within(summary).getByText('后端版本注册表')).toBeInTheDocument();
    expect(within(summary).getByText('已准备')).toBeInTheDocument();
    expect(screen.queryByText(/Not verified|Passed|Execution guardrails/)).not.toBeInTheDocument();
  });

  test('renders the complete launch summary in English', async () => {
    mockTaskApi();
    renderTasks({ language: 'en' });

    const summary = screen.getByRole('region', { name: 'Launch summary' });
    await waitFor(() => expect(within(summary).getByTestId('launch-estimate')).toHaveTextContent('About 3–5 min'));
    for (const label of [
      'Object',
      'Trigger mode',
      'Execution profile',
      'Execution & report version',
      'Version source',
      'Script count',
      'Estimated time',
      'Readiness'
    ]) {
      expect(within(summary).getByText(label)).toBeInTheDocument();
    }
    expect(within(summary).getByText('Ready')).toBeInTheDocument();
  });

  test('keeps responsive segmented choices and selectable rows at least 44px tall', () => {
    expect(tasksStyles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-segmented\s*\{[^}]*height:\s*52px;/
    );
    expect(tasksStyles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-segmented label > span\s*\{[^}]*height:\s*44px;/
    );
    expect(tasksStyles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.tasks-table-scroll tbody tr\s*\{[^}]*height:\s*68px;/
    );
  });

  test('contains the script table scroller inside its card at every stacked breakpoint', () => {
    const compressedDesktopStart = tasksStyles.indexOf('@media (max-width: 1319px)');
    const stackedStart = tasksStyles.indexOf('@media (max-width: 1179px)');
    const tabletStart = tasksStyles.indexOf('@media (max-width: 980px)');
    const mobileStart = tasksStyles.indexOf('@media (max-width: 680px)');

    expect(compressedDesktopStart).toBeGreaterThanOrEqual(0);
    expect(stackedStart).toBeGreaterThan(compressedDesktopStart);
    expect(tabletStart).toBeGreaterThan(stackedStart);
    expect(mobileStart).toBeGreaterThan(tabletStart);
    expect(tasksStyles.slice(compressedDesktopStart, stackedStart)).toMatch(
      /\.tasks-table-scroll\s*\{[^}]*width:\s*auto;/
    );
    expect(tasksStyles.slice(compressedDesktopStart, stackedStart)).toMatch(
      /\.tasks-fields\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    );
    expect(tasksStyles.slice(stackedStart, tabletStart)).toMatch(
      /\.tasks-table-scroll\s*\{[^}]*width:\s*auto;/
    );
    expect(tasksStyles.slice(tabletStart, mobileStart)).toMatch(
      /\.tasks-right-rail\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    );
    expect(tasksStyles.slice(tabletStart, mobileStart)).toMatch(
      /\.tasks-launch-button\s*\{[^}]*width:\s*100%;/
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
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable test batch',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
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

  test('encodes the approved spacious desktop Tasks geometry', () => {
    expect(tasksStyles).toMatch(/\.tasks-page \.page-header\s*\{[^}]*height:\s*118px;[^}]*min-height:\s*118px;[^}]*margin-bottom:\s*24px;/s);
    expect(tasksStyles).not.toMatch(/\.tasks-create-task\s*\{/);
    expect(tasksStyles).toMatch(/\.tasks-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*856px\) minmax\(0,\s*416px\);[^}]*gap:\s*24px;/s);
    expect(tasksStyles).toMatch(/\.tasks-left-column\s*\{[^}]*grid-template-rows:\s*auto minmax\(376px,\s*auto\);[^}]*gap:\s*24px;/s);
    expect(tasksStyles).toMatch(/\.tasks-right-rail\s*\{[^}]*grid-template-rows:\s*auto;[^}]*align-content:\s*start;/s);
    expect(tasksStyles).toMatch(/\.tasks-config-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*388px;[^}]*padding:\s*24px 28px;/s);
    expect(tasksStyles).toMatch(/\.tasks-steps\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*64px;[^}]*grid-template-columns:\s*repeat\(3,\s*260px\);[^}]*gap:\s*10px;/s);
    expect(tasksStyles).toMatch(/\.tasks-object-summary\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*64px;[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
    expect(tasksStyles).toMatch(/\.tasks-segmented\s*\{[^}]*width:\s*360px;[^}]*height:\s*52px;[^}]*border-radius:\s*14px;/s);
    expect(tasksStyles).toMatch(/\.tasks-fields\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*52px;[^}]*gap:\s*12px;/s);
    expect(tasksStyles).toMatch(/\.tasks-snapshot-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*376px;/s);
    expect(tasksStyles).toMatch(/\.tasks-script-search\s*\{[^}]*width:\s*330px;[^}]*height:\s*48px;[^}]*min-height:\s*48px;/s);
    expect(tasksStyles).toMatch(/\.tasks-table-scroll th\s*\{[^}]*height:\s*44px;/s);
    expect(tasksStyles).toMatch(/\.tasks-table-scroll td\s*\{[^}]*height:\s*68px;/s);
    expect(tasksStyles).toMatch(/\.tasks-launch-card\s*\{[^}]*display:\s*flex;[^}]*height:\s*auto;[^}]*min-height:\s*634px;/s);
    expect(tasksStyles).toMatch(/\.tasks-launch-list > div\s*\{[^}]*min-height:\s*52px;/s);
    expect(tasksStyles).not.toMatch(/\.tasks-guardrail-card\s*\{/);
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
      feature: 'Save API',
      version: 'release1'
    });
    await waitFor(() => expect(screen.getByTestId('location-path')).toHaveTextContent(
      '/observation|task_feature|/api'
    ));
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
      level: 'L1',
      version: 'release1'
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
      script_name: ['save_api_test'],
      version: 'release1'
    });
  });

  test('creates an entire-scene task with only Object scope and the selected test batch', async () => {
    const user = userEvent.setup();
    const onTaskCreated = vi.fn();
    const fetchSpy = mockTaskApi({ taskId: 'task_scene', triggerType: 'scene' });
    renderTasks({ onTaskCreated });

    await user.click(screen.getByRole('radio', { name: '整个场景' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: '执行版本' }), 'release2');
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => {
      const url = new URL(String(input), 'http://local.test');
      return url.pathname.endsWith('/scripts') && url.searchParams.has('feature');
    })).toBe(true));
    expect(fetchSpy.mock.calls.some(([input]) => {
      const url = new URL(String(input), 'http://local.test');
      return url.pathname.endsWith('/scripts') &&
        !url.searchParams.has('feature') &&
        !url.searchParams.has('level');
    })).toBe(false);
    expect(screen.getByTestId('task-mode-summary')).toHaveTextContent('整个场景 · 全部脚本');
    expect(screen.getByTestId('task-version-summary')).toHaveTextContent('release2');
    await user.click(screen.getByRole('button', { name: '启动执行' }));

    await waitFor(() => expect(onTaskCreated).toHaveBeenCalledTimes(1));
    expect(postPayload(fetchSpy)).toEqual({
      product: selectedSut.product,
      scene: selectedSut.scene,
      version: 'release2'
    });
  });
});
