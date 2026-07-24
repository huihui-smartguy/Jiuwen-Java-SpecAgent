import { existsSync, readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { normalizeTaskStatus } from '../api/client';
import { resolveRuntimeConfig } from '../config/runtime';
import { copy } from '../i18n';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';
import { Results } from './Results';

const mockRuntimeConfig = resolveRuntimeConfig({
  defaultLanguage: 'zh',
  enableMockFallback: true
});

function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response);
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function renderResults({
  language = 'zh',
  runtimeConfig = mockRuntimeConfig,
  selectedSut = runtimeConfig.sutTargets[0],
  activeTask = null,
  sessionTasks = []
}: {
  language?: Language;
  runtimeConfig?: RuntimeConfig;
  selectedSut?: SutTarget;
  activeTask?: NormalizedTaskStatus | null;
  sessionTasks?: NormalizedTaskStatus[];
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/results']}>
        <Routes>
          <Route
            path="/results"
            element={(
              <Results
                language={language}
                selectedSut={selectedSut}
                activeTask={activeTask}
                sessionTasks={sessionTasks}
                runtimeConfig={runtimeConfig}
              />
            )}
          />
          <Route path="/results/:reportId" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function task(
  taskId: string,
  overrides: Partial<NormalizedTaskStatus>
): NormalizedTaskStatus {
  return {
    ...normalizeTaskStatus({
      success: true,
      task_id: taskId,
      status: 'success',
      trigger_type: 'feature'
    }),
    ...overrides,
    task_id: taskId
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('Results', () => {
  test('labels each live session report with the Object that created that task', () => {
    const runtimeConfig = resolveRuntimeConfig({
      enableMockFallback: false,
      sutTargets: [
        {
          id: 'origin-object',
          name: 'Origin Object',
          product: 'Origin product',
          scene: 'API',
          version: 'v1',
          apiBaseUrl: '/origin-api',
          status: 'healthy'
        },
        {
          id: 'new-object',
          name: 'New Object',
          product: 'New product',
          scene: 'API',
          version: 'v2',
          apiBaseUrl: '/new-api',
          status: 'healthy'
        }
      ]
    });
    const originTask = task('task-origin', {
      sourceSut: runtimeConfig.sutTargets[0]
    } as Partial<NormalizedTaskStatus>);

    renderResults({
      runtimeConfig,
      selectedSut: runtimeConfig.sutTargets[1],
      activeTask: originTask,
      sessionTasks: [originTask]
    });

    const reports = screen.getByRole('region', { name: '最近报告' });
    expect(within(reports).getByText('Origin product API')).toBeInTheDocument();
    expect(within(reports).queryByText('New product API')).not.toBeInTheDocument();
  });

  test('retains same-named tasks from different source backends as distinct session evidence', () => {
    const runtimeConfig = resolveRuntimeConfig({
      enableMockFallback: false,
      sutTargets: [
        {
          id: 'source-a',
          name: 'Source A',
          product: 'Product A',
          scene: 'API',
          version: 'v1',
          apiBaseUrl: '/source-a-api',
          status: 'healthy'
        },
        {
          id: 'source-b',
          name: 'Source B',
          product: 'Product B',
          scene: 'API',
          version: 'v1',
          apiBaseUrl: '/source-b-api',
          status: 'healthy'
        }
      ]
    });
    const fromA = task('shared-task-id', { sourceSut: runtimeConfig.sutTargets[0] });
    const fromB = task('shared-task-id', { sourceSut: runtimeConfig.sutTargets[1] });

    renderResults({
      runtimeConfig,
      selectedSut: runtimeConfig.sutTargets[0],
      activeTask: fromA,
      sessionTasks: [fromA, fromB]
    });

    const reports = screen.getByRole('region', { name: '最近报告' });
    expect(within(reports).getAllByText('报告 · shared-task-id')).toHaveLength(2);
    expect(within(reports).getByText('Product A API')).toBeInTheDocument();
    expect(within(reports).getByText('Product B API')).toBeInTheDocument();
  });

  test('uses the runtime fallback consistently when a task target omits its API base URL', () => {
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      enableMockFallback: false,
      sutTargets: [
        {
          id: 'runtime-source',
          name: 'Runtime source',
          product: 'Runtime product',
          scene: 'API',
          version: 'v1',
          apiBaseUrl: '',
          status: 'healthy'
        },
        {
          id: 'api-source',
          name: 'API source',
          product: 'API product',
          scene: 'API',
          version: 'v1',
          apiBaseUrl: '/api',
          status: 'healthy'
        }
      ]
    });
    const fromRuntime = task('shared-fallback-id', { sourceSut: runtimeConfig.sutTargets[0] });
    const fromApi = task('shared-fallback-id', { sourceSut: runtimeConfig.sutTargets[1] });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderResults({
      runtimeConfig,
      selectedSut: runtimeConfig.sutTargets[0],
      activeTask: fromRuntime,
      sessionTasks: [fromRuntime, fromApi]
    });

    const reports = screen.getByRole('region', { name: '最近报告' });
    expect(within(reports).getAllByText('shared-fallback-id')).toHaveLength(2);
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key');
  });

  test('keeps Results level copy distinct from the existing log-level filter copy', () => {
    expect(copy.zh.allLevels).toBe('全部日志级别');
    expect(copy.zh.allResultLevels).toBe('全部级别');
    expect(copy.en.allLevels).toBe('All levels');
    expect(copy.en.allResultLevels).toBe('All levels');
  });

  test('renders the exact approved mock composition and values', () => {
    renderResults();

    expect(screen.getByRole('heading', { name: '结果与报告', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('聚合通过率、失败趋势与可追溯报告，快速定位质量变化。')).toBeInTheDocument();
    const pageHeader = screen.getByRole('heading', { name: '结果与报告', level: 1 }).closest('.page-header');
    expect(within(pageHeader as HTMLElement).getByRole('button', { name: '筛选' })).toBeInTheDocument();
    expect(within(pageHeader as HTMLElement).getByRole('button', { name: '生成报告' })).toBeInTheDocument();
    expect(pageHeader?.querySelector('svg')).not.toBeInTheDocument();

    const metrics = screen.getByRole('region', { name: '结果指标' });
    expect(within(metrics).getAllByRole('article')).toHaveLength(4);
    expect(metrics.querySelector('svg')).not.toBeInTheDocument();
    expect(within(metrics).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      '本周报告',
      '综合通过率',
      '失败用例',
      '平均时长'
    ]);
    expect(within(metrics).getAllByTestId('metric-value').map((value) => value.textContent)).toEqual([
      '18',
      '91.8%',
      '7',
      '6分42秒'
    ]);
    expect(
      within(metrics).getAllByRole('article').map((card) => card.querySelector('p')?.textContent)
    ).toEqual(['较上周 +3', '近 7 天 +2.4%', '需要复核', '较上周 -38秒']);

    const trend = screen.getByRole('region', { name: '通过率趋势' });
    expect(within(trend).getByRole('heading', { level: 2, name: '通过率趋势' })).toBeInTheDocument();
    expect(within(trend).getByText('近 7 天')).toBeInTheDocument();
    expect(within(trend).queryByText('+2.1%')).not.toBeInTheDocument();
    expect(within(trend).queryByText(/全部级别|Unified Version API ·/)).not.toBeInTheDocument();

    const failures = screen.getByRole('region', { name: '失败分布' });
    expect(within(failures).getByText('7 个用例')).toBeInTheDocument();
    const failureRows = within(failures).getAllByRole('listitem');
    expect(failureRows).toHaveLength(4);
    expect(failureRows.map((row) => row.textContent)).toEqual([
      '断言失败3',
      '环境异常2',
      '执行超时1',
      '数据准备1'
    ]);
    expect(failureRows.map((row) => (
      (row.querySelector('.results-failure-track > span') as HTMLElement).style.width
    ))).toEqual(['316px', '213px', '130px', '102px']);

    const reports = screen.getByRole('region', { name: '最近报告' });
    expect(within(reports).getByText('TRACEABLE ARTIFACTS')).toBeInTheDocument();
    expect(reports.querySelector('svg')).not.toBeInTheDocument();
    expect(within(reports).getAllByRole('row')).toHaveLength(5);
    expect(within(reports).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '报告',
      'Object',
      '任务',
      '结果',
      '完成时间',
      '操作'
    ]);
    for (const expected of [
      '回归验证 · API 密钥管理',
      'task-ad06c8e5',
      'Unified Version API',
      '今天 10:42',
      '角色权限边界验证',
      'task-c91b2d4a',
      '会话过期策略回归',
      '数据源配置冒烟'
    ]) {
      expect(within(reports).getAllByText(expected).length).toBeGreaterThan(0);
    }
    const reportActions = within(reports).getAllByRole('button', { name: /查看用例/ });
    expect(reportActions).toHaveLength(4);
    expect(new Set(reportActions.map((action) => action.getAttribute('aria-label'))).size).toBe(4);
    expect(reportActions.map((action) => action.getAttribute('aria-label'))).toEqual([
      '查看用例：回归验证 · API 密钥管理，task-ad06c8e5',
      '查看用例：角色权限边界验证，task-c91b2d4a',
      '查看用例：会话过期策略回归，task-7f1820bd',
      '查看用例：数据源配置冒烟，task-2e9a170c'
    ]);
    expect(reportActions.map((action) => action.textContent)).toEqual([
      '查看用例  →',
      '查看用例  →',
      '查看用例  →',
      '查看用例  →'
    ]);
    expect(reports.querySelector('.results-pass-rate')).not.toBeInTheDocument();
    expect(
      Array.from(reports.querySelectorAll('.results-status-pill'), (pill) => pill.getAttribute('aria-label'))
    ).toEqual([
      '通过，通过率 100.0%',
      '失败，通过率 75.0%',
      '通过，通过率 100.0%',
      '部分通过，通过率 80.0%'
    ]);
    expect(within(reports).getAllByText('Unified Version API')).toHaveLength(4);
    expect(within(reports).getByText('7 月 13 日')).toBeInTheDocument();
    expect(within(reports).getByRole('searchbox', { name: '搜索报告或任务' })).toHaveAttribute(
      'placeholder',
      '搜索报告或任务'
    );
  });

  test('localizes every authored fallback label when English is selected', () => {
    renderResults({ language: 'en' });

    expect(screen.getByRole('heading', { level: 1, name: 'Results & reports' })).toBeInTheDocument();
    expect(screen.getByText('6m 42s')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Assertion failure')).toBeInTheDocument();
    expect(screen.getByText('Regression validation · API key management')).toBeInTheDocument();
    expect(screen.getByText('Today 10:42')).toBeInTheDocument();
    expect(screen.getAllByText('Passed')).toHaveLength(2);
    expect(screen.queryByText('周一')).not.toBeInTheDocument();
    expect(screen.queryByText('断言失败')).not.toBeInTheDocument();
    expect(screen.queryByText('回归验证 · API 密钥管理')).not.toBeInTheDocument();
  });

  test('keeps mock mode report-free while making Filter functional', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderResults();

    const filter = screen.getByRole('button', { name: '筛选' });
    expect(filter).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(filter);
    expect(screen.getByRole('region', { name: '报告筛选条件' })).toBeInTheDocument();

    const generate = screen.getByRole('button', { name: '生成报告' });
    expect(generate).toHaveAttribute('aria-disabled', 'true');
    expect(generate).not.toBeDisabled();
    await user.click(generate);

    for (const control of screen.getAllByRole('button', { name: /查看用例/ })) {
      expect(control).toHaveAttribute('aria-disabled', 'true');
      expect(control).not.toBeDisabled();
      await user.click(control);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/results');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('exposes the approved seven-day trend as seven labelled non-interactive bars', () => {
    renderResults();

    const trend = screen.getByRole('region', { name: '通过率趋势' });
    const chart = within(trend).getByRole('img', { name: /通过率趋势/ });
    expect(chart.tagName.toLowerCase()).toBe('div');
    expect(chart).toHaveAttribute('data-point-count', '7');
    expect(chart.querySelectorAll('.results-trend-bar')).toHaveLength(7);
    expect(Array.from(chart.querySelectorAll<HTMLElement>('.results-trend-bar'), (bar) => (
      bar.style.height
    ))).toEqual(['72px', '88px', '96px', '82px', '104px', '94px', '112px']);
    expect(within(chart).getAllByText(/周[一二三四五六]|今天/).map((label) => label.textContent)).toEqual([
      '周一', '周二', '周三', '周四', '周五', '周六', '今天'
    ]);
    expect(chart.querySelector('svg')).not.toBeInTheDocument();
    expect(chart.querySelector('[tabindex], [role="button"]')).not.toBeInTheDocument();
  });

  test('derives live rows and summaries only from de-duplicated supplied task state', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const runtimeConfig = resolveRuntimeConfig({
      defaultLanguage: 'zh',
      enableMockFallback: false,
      sutTargets: [{
        id: 'live-object',
        name: 'Live Object',
        product: 'LiveProduct',
        scene: 'API',
        version: 'v9',
        apiBaseUrl: '/live-api',
        status: 'healthy'
      }]
    });
    const staleDuplicate = task('task-alpha', {
      status: 'failed',
      uiStatus: 'failed',
      isTerminal: true,
      result: { total_commands: 10, success_count: 4, failed_count: 6 },
      completed_at: '2026-07-12T08:00:00',
      elapsed_time: '06:00'
    });
    const sessionTask = task('task-beta', {
      result: { total_commands: 4, success_count: 3, failed_count: 1 },
      completed_at: '2026-07-13T09:30:00',
      elapsed_time: '02:00'
    });
    const latestActiveTask = task('task-alpha', {
      result: { total_commands: 8, success_count: 7, failed_count: 1 },
      completed_at: '2026-07-14T10:45:00',
      elapsed_time: '04:00'
    });

    renderResults({
      runtimeConfig,
      selectedSut: runtimeConfig.sutTargets[0],
      activeTask: latestActiveTask,
      sessionTasks: [staleDuplicate, sessionTask, staleDuplicate]
    });

    expect(screen.getByRole('tab', { name: '会话结果' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '持久化报告' })).toHaveAttribute('aria-selected', 'false');

    const metrics = screen.getByRole('region', { name: '结果指标' });
    expect(within(metrics).getAllByTestId('metric-value').map((value) => value.textContent)).toEqual([
      '2',
      '83.3%',
      '2',
      '03:00'
    ]);

    const reports = screen.getByRole('region', { name: '最近报告' });
    expect(within(reports).getAllByRole('row')).toHaveLength(3);
    expect(within(reports).getAllByText('task-alpha')).toHaveLength(1);
    expect(within(reports).getByText('task-beta')).toBeInTheDocument();
    expect(within(reports).getAllByText('LiveProduct API')).toHaveLength(2);
    expect(within(reports).getByLabelText(/通过率 87\.5%/)).toBeInTheDocument();
    expect(within(reports).getByLabelText(/通过率 75\.0%/)).toBeInTheDocument();
    expect(within(reports).queryByLabelText(/通过率 40\.0%/)).not.toBeInTheDocument();

    const failures = screen.getByRole('region', { name: '失败分布' });
    expect(within(failures).getByText('2 个用例')).toBeInTheDocument();
    expect(within(failures).getAllByRole('listitem')).toHaveLength(1);
    expect(within(failures).getByText('当前版本暂无失败分布')).toBeInTheDocument();
    for (const mockOnlyValue of [
      '42',
      '93.6%',
      '17',
      '05:48',
      'EXEC-2042',
      'API 密钥',
      '用户权限',
      '会话管理',
      '其他'
    ]) {
      expect(screen.queryByText(mockOnlyValue)).not.toBeInTheDocument();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test.each([
    {
      id: 'all-pass',
      overrides: {
        result: { total_commands: 4, success_count: 4, failed_count: 0 }
      },
      expectedResult: '成功',
      expectedRate: '100.0%'
    },
    {
      id: 'mixed-result',
      overrides: {
        result: { total_commands: 4, success_count: 3, failed_count: 1 }
      },
      expectedResult: '部分通过',
      expectedRate: '75.0%'
    },
    {
      id: 'all-failed-completed',
      overrides: {
        backend_status: 'completed' as const,
        result: { total_commands: 4, success_count: 0, failed_count: 4 }
      },
      expectedResult: '失败',
      expectedRate: '0.0%'
    },
    {
      id: 'cancelled-result',
      overrides: {
        status: 'cancelled' as const,
        uiStatus: 'cancelled' as const,
        isTerminal: true,
        result: { total_commands: 4, success_count: 2, failed_count: 2 }
      },
      expectedResult: '已取消',
      expectedRate: '50.0%'
    },
    {
      id: 'running-result',
      overrides: {
        status: 'running' as const,
        uiStatus: 'running' as const,
        isTerminal: false,
        result: undefined
      },
      expectedResult: '执行中',
      expectedRate: '—'
    }
  ])('classifies the $id live report consistently', ({
    id,
    overrides,
    expectedResult,
    expectedRate
  }) => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    renderResults({
      runtimeConfig,
      sessionTasks: [task(id, overrides)]
    });

    const row = screen.getByText(id).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText(expectedResult)).toBeInTheDocument();
    expect(row!.querySelector('.results-status-pill')).toHaveAttribute(
      'aria-label',
      `${expectedResult}，通过率 ${expectedRate}`
    );
    expect(row!.querySelector('.results-pass-rate')).not.toBeInTheDocument();
  });

  test('never presents a running task start time as Completed evidence', () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    const runningTask = task('task-started-only', {
      status: 'running',
      uiStatus: 'running',
      isTerminal: false,
      started_at: '2026-07-14T10:45:00',
      completed_at: undefined
    });

    renderResults({
      runtimeConfig,
      activeTask: runningTask,
      sessionTasks: [runningTask]
    });

    const row = screen.getByText('task-started-only').closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row!).getAllByRole('cell');
    expect(cells[4]).toHaveTextContent('—');
    expect(row).not.toHaveTextContent('2026-07-14 · 10:45');
  });

  test('uses a dash or zero when live report result and timing fields are absent', () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    const progressOnlyTask = task('task-progress-only', {
      status: 'running',
      uiStatus: 'running',
      isTerminal: false,
      result: undefined,
      elapsed_time: undefined,
      progress: {
        total_commands: 10,
        completed: 5,
        failed: 2,
        current_command: 'pytest progress_only'
      }
    });

    renderResults({
      runtimeConfig,
      activeTask: progressOnlyTask,
      sessionTasks: [progressOnlyTask]
    });

    const metrics = screen.getByRole('region', { name: '结果指标' });
    expect(within(metrics).getAllByTestId('metric-value').map((value) => value.textContent)).toEqual([
      '1',
      '—',
      '0',
      '—'
    ]);
    const reports = screen.getByRole('region', { name: '最近报告' });
    expect(within(reports).getByText('task-progress-only')).toBeInTheDocument();
    expect(within(reports).getByText('执行中')).toBeInTheDocument();
    expect(within(reports).getByLabelText('执行中，通过率 —')).toBeInTheDocument();
    expect(within(reports).getAllByText('—')).toHaveLength(1);
  });

  test('filters recent reports in memory without issuing a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderResults();

    const reports = screen.getByRole('region', { name: '最近报告' });
    const search = within(reports).getByRole('searchbox', { name: '搜索报告或任务' });
    expect(within(reports).getAllByRole('row')).toHaveLength(5);

    await user.type(search, 'c91b');

    expect(within(reports).getAllByRole('row')).toHaveLength(2);
    expect(within(reports).getByText('task-c91b2d4a')).toBeInTheDocument();
    expect(within(reports).queryByText('task-ad06c8e5')).not.toBeInTheDocument();
    expect(within(reports).queryByText('task-7f1820bd')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('shows equal 715/615 names and codes once in report filters and generation', async () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: '715:0.2.0.beta3.post3',
          versions: [
            {
              code: '715:0.2.0.beta3.post3',
              name: '715:0.2.0.beta3.post3',
              description: 'Modeled quality snapshot',
              created_at: '2026-07-24',
              is_default: true
            },
            {
              code: '615:0.2.0.beta3',
              name: '615:0.2.0.beta3',
              description: 'Authoritative quality snapshot',
              created_at: '2026-07-24',
              is_default: false
            }
          ]
        });
      }
      if (url.pathname.endsWith('/reports')) {
        return json({ success: true, total: 0, reports: [] });
      }
      if (url.pathname.endsWith('/features')) {
        return json({
          success: true,
          product: runtimeConfig.sutTargets[0].product,
          scene: runtimeConfig.sutTargets[0].scene,
          features: [],
          total: 0
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    renderResults({ runtimeConfig, activeTask: null, sessionTasks: [] });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '筛选' }));
    const filterVersion = await screen.findByRole('combobox', {
      name: /执行\s*\/\s*报告版本/
    });
    expect(filterVersion).toHaveValue('715:0.2.0.beta3.post3');
    expect(within(filterVersion).getAllByRole('option').map((option) => ({
      label: option.textContent,
      value: (option as HTMLOptionElement).value
    }))).toEqual([
      {
        label: '715:0.2.0.beta3.post3',
        value: '715:0.2.0.beta3.post3'
      },
      {
        label: '615:0.2.0.beta3',
        value: '615:0.2.0.beta3'
      }
    ]);

    await user.click(screen.getByRole('button', { name: '生成报告' }));
    const modal = await screen.findByRole('dialog', { name: '生成报告' });
    const modalVersion = within(modal).getByRole('combobox', {
      name: /执行\s*\/\s*报告版本/
    });
    expect(within(modalVersion).getAllByRole('option').map((option) => ({
      label: option.textContent,
      value: (option as HTMLOptionElement).value
    }))).toEqual([
      {
        label: '715:0.2.0.beta3.post3',
        value: '715:0.2.0.beta3.post3'
      },
      {
        label: '615:0.2.0.beta3',
        value: '615:0.2.0.beta3'
      }
    ]);
  });

  test('uses one Object-scoped registered version, reconciles exact matches, and paginates locally', async () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    const exactReports = Array.from({ length: 21 }, (_, index) => ({
      id: `report-exact-${String(index + 1).padStart(2, '0')}`,
      title: `Release 1 report ${String(index + 1).padStart(2, '0')}`,
      software_version: 'release1',
      summary: {
        total: 10,
        pass: 9,
        failed: 1,
        skipped: 0,
        running: 0,
        success_rate: 90,
        total_duration_seconds: 42
      },
      conclusion: { passed: false, verdict: '不通过', reason: 'One failure' },
      created_at: `2026-07-${String(Math.min(index + 1, 21)).padStart(2, '0')}T10:30:00`,
      created_by: 'codex-verification'
    }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname.endsWith('/reports')) {
        return json({
          success: true,
          total: 22,
          reports: [
            ...exactReports,
            {
              ...exactReports[0],
              id: 'report-prefix-collision',
              title: 'Release 10 prefix collision',
              software_version: 'release10'
            }
          ]
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderResults({ runtimeConfig, activeTask: null, sessionTasks: [] });

    const persistedTab = screen.getByRole('tab', { name: '持久化报告' });
    const sessionTab = screen.getByRole('tab', { name: '会话结果' });
    expect(persistedTab).toHaveAttribute('aria-selected', 'true');
    persistedTab.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(sessionTab).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(persistedTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => {
      const url = new URL(String(input), 'http://local.test');
      return url.pathname === '/api/reports'
        && url.searchParams.get('software_version') === 'release1'
        && url.searchParams.get('test_version') === 'release1'
        && url.searchParams.get('product') === runtimeConfig.sutTargets[0].product
        && url.searchParams.get('scene') === runtimeConfig.sutTargets[0].scene
        && url.searchParams.get('limit') === '200'
        && url.searchParams.get('offset') === '0';
    })).toBe(true));
    expect(await screen.findByText('Release 1 report 01')).toBeInTheDocument();
    expect(screen.queryByText('Release 10 prefix collision')).not.toBeInTheDocument();
    expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument();
    const reportRequestsBeforeSearch = fetchSpy.mock.calls.filter(([input]) => (
      String(input).includes('/reports?')
    )).length;
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索报告或任务' }), 'report 07');
    expect(screen.getByText('Release 1 report 07')).toBeInTheDocument();
    expect(screen.queryByText('Release 1 report 01')).not.toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).includes('/reports?')))
      .toHaveLength(reportRequestsBeforeSearch);
    await userEvent.clear(screen.getByRole('searchbox', { name: '搜索报告或任务' }));

    await userEvent.click(screen.getByRole('button', { name: '筛选' }));
    const versionControl = screen.getByRole('combobox', { name: /执行\s*\/\s*报告版本/ });
    expect(versionControl).toHaveValue('release1');
    expect(screen.queryByRole('combobox', { name: /测试批次/ })).not.toBeInTheDocument();
    expect(screen.getByText('task.version → report.software_version')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(await screen.findByText('Release 1 report 21')).toBeInTheDocument();
    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).includes('/reports?')))
      .toHaveLength(reportRequestsBeforeSearch);
  });

  test('never promotes the Object display version into report semantics and remembers the registered canonical version', async () => {
    const runtimeConfig = resolveRuntimeConfig({
      enableMockFallback: false,
      sutTargets: [{
        id: 'generic-version-object',
        name: 'Generic version Object',
        product: 'AgentPlatform',
        scene: 'API',
        version: 'Latest',
        apiBaseUrl: '/api',
        status: 'healthy'
      }]
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname.endsWith('/reports')) {
        return json({ success: true, total: 0, reports: [] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderResults({ runtimeConfig, selectedSut: runtimeConfig.sutTargets[0] });

    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => (
      String(input).includes('/api/reports?software_version=release1')
    ))).toBe(true));
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes('software_version=Latest')))
      .toBe(false);
    await userEvent.click(screen.getByRole('button', { name: '筛选' }));
    expect(screen.getByRole('combobox', { name: /执行\s*\/\s*报告版本/ }))
      .toHaveValue('release1');
    expect(screen.queryByRole('textbox', { name: /软件版本|构建号/ })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('testwise.reportCanonicalVersion:generic-version-object'))
      .toBe('release1');
  });

  test('generates a scoped report from an accessible modal and opens its detail route', async () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    const sessionTask = task('task-for-report', {
      version: 'release1',
      result: { total_commands: 1, success_count: 1, failed_count: 0 }
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname.endsWith('/features')) {
        return json({
          success: true,
          product: runtimeConfig.sutTargets[0].product,
          scene: runtimeConfig.sutTargets[0].scene,
          features: [{ id: 'save', name: 'Save API', type: 'L1' }],
          total: 1
        });
      }
      if (url.pathname.endsWith('/reports') && init?.method === 'POST') {
        return json({ success: true, report_id: 'report-created-20260715' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderResults({ runtimeConfig, activeTask: sessionTask, sessionTasks: [sessionTask] });

    const user = userEvent.setup();
    const generate = screen.getByRole('button', { name: '生成报告' });
    await user.click(generate);
    let modal = await screen.findByRole('dialog', { name: '生成报告' });
    expect(within(modal).getByRole('button', { name: '关闭生成报告' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '生成报告' })).not.toBeInTheDocument();
    expect(generate).toHaveFocus();
    await user.click(generate);
    modal = await screen.findByRole('dialog', { name: '生成报告' });
    expect(within(modal).getByText('High-Code Java Scene'))
      .toBeInTheDocument();
    const reportVersion = within(modal).getByRole('combobox', {
      name: /执行\s*\/\s*报告版本/
    });
    await waitFor(() => expect(reportVersion).toHaveValue('release1'));
    expect(within(modal).queryByRole('combobox', { name: /测试批次/ })).not.toBeInTheDocument();
    expect(within(modal).getByText('task.version → report.software_version')).toBeInTheDocument();
    expect(within(modal).getByText('后端版本注册表')).toBeInTheDocument();
    await user.selectOptions(within(modal).getByRole('combobox', { name: 'Feature（可选）' }), 'Save API');
    await user.selectOptions(within(modal).getByRole('combobox', { name: '级别（可选）' }), 'L1');
    await user.type(within(modal).getByRole('textbox', { name: '报告标题（可选）' }), 'Release verification');
    await user.type(within(modal).getByLabelText('开始时间（可选）'), '2026-07-15T09:00');
    await user.type(within(modal).getByLabelText('结束时间（可选）'), '2026-07-15T10:00');
    await user.click(within(modal).getByRole('button', { name: '创建并打开报告' }));

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({
        test_version: 'release1',
        software_version: 'release1',
        scope: {
          product: runtimeConfig.sutTargets[0].product,
          scenes: [runtimeConfig.sutTargets[0].scene],
          features: ['Save API'],
          levels: ['L1']
        },
        title: 'Release verification',
        time_window: ['2026-07-15T09:00', '2026-07-15T10:00']
      });
    });
    expect(await screen.findByTestId('location-path')).toHaveTextContent('/results/report-created-20260715');
  });

  test('omits All scope restrictions and surfaces backend 400 generation errors', async () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    const sessionTask = task('task-report-error', {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname.endsWith('/features')) {
        return json({ success: true, product: '高码java', scene: '场景', features: [], total: 0 });
      }
      if (url.pathname.endsWith('/reports') && init?.method === 'POST') {
        return json({ success: false, message: 'No matching execution results' }, 400);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderResults({ runtimeConfig, activeTask: sessionTask, sessionTasks: [sessionTask] });
    await userEvent.click(screen.getByRole('button', { name: '生成报告' }));
    const modal = await screen.findByRole('dialog', { name: '生成报告' });
    await waitFor(() => expect(within(modal).getByRole('combobox', {
      name: /执行\s*\/\s*报告版本/
    })).toHaveValue('release1'));
    await userEvent.click(within(modal).getByRole('button', { name: '创建并打开报告' }));

    expect(await within(modal).findByRole('alert')).toHaveTextContent('No matching execution results');
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      test_version: 'release1',
      software_version: 'release1',
      scope: {
        product: runtimeConfig.sutTargets[0].product,
        scenes: [runtimeConfig.sutTargets[0].scene]
      }
    });
  });

  test('treats a persisted report with zero executions as neutral, no matching data, and explicitly unbound', async () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname.endsWith('/reports')) {
        return json({
          success: true,
          total: 1,
          reports: [{
            id: 'report-zero-executions',
            title: '零执行数据报告',
            software_version: 'release1',
            summary: {
              total: 0,
              pass: 0,
              failed: 0,
              skipped: 0,
              running: 0,
              success_rate: 100,
              total_duration_seconds: 0
            },
            conclusion: {
              passed: true,
              verdict: '通过',
              reason: 'Backend must not override the zero-execution state'
            },
            created_at: '2026-07-15T10:30:00',
            created_by: 'codex-verification'
          }]
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderResults({ runtimeConfig, activeTask: null, sessionTasks: [] });

    const reportTitle = await screen.findByText('零执行数据报告');
    const row = reportTitle.closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('release1')).toBeInTheDocument();
    expect(within(row!).getByText('未绑定')).toHaveAttribute(
      'title',
      '当前后端未提供报告到任务的稳定关联字段'
    );
    const outcome = within(row!).getByLabelText('无匹配数据, —');
    expect(outcome).toHaveTextContent('无匹配数据');
    expect(outcome).toHaveClass('is-neutral');
    expect(within(row!).queryByText('通过')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '结果指标' }))
      .getAllByTestId('metric-value').map((value) => value.textContent)).toEqual([
      '1', '—', '0', '—'
    ]);
  });

  test('does not auto-retry an outcome-unknown report POST and sends the user to reconciliation', async () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    const sessionTask = task('task-outcome-unknown', { version: 'release1' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname.endsWith('/features')) {
        return json({ success: true, product: '高码java', scene: '场景', features: [], total: 0 });
      }
      if (url.pathname.endsWith('/reports') && init?.method === 'POST') {
        return Promise.reject(new TypeError('connection closed after request upload'));
      }
      if (url.pathname.endsWith('/reports')) {
        return json({ success: true, total: 0, reports: [] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderResults({ runtimeConfig, activeTask: sessionTask, sessionTasks: [sessionTask] });
    await userEvent.click(screen.getByRole('button', { name: '生成报告' }));
    const modal = await screen.findByRole('dialog', { name: '生成报告' });
    await waitFor(() => expect(within(modal).getByRole('combobox', {
      name: /执行\s*\/\s*报告版本/
    })).toHaveValue('release1'));
    await userEvent.click(within(modal).getByRole('button', { name: '创建并打开报告' }));

    const reconciliation = await within(modal).findByRole('status');
    expect(reconciliation).toHaveTextContent('生成结果暂时未知');
    expect(reconciliation).toHaveTextContent('避免重复快照');
    expect(screen.getByTestId('location-path')).toHaveTextContent('/results');
    const reportPosts = () => fetchSpy.mock.calls.filter(([, request]) => request?.method === 'POST');
    expect(reportPosts()).toHaveLength(1);
    await Promise.resolve();
    expect(reportPosts()).toHaveLength(1);

    await userEvent.click(within(reconciliation).getByRole('button', { name: '查看持久化报告' }));
    expect(screen.queryByRole('dialog', { name: '生成报告' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '持久化报告' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input, request]) => (
      String(input).includes('/reports?') && request?.method !== 'POST'
    ))).toBe(true));
    expect(reportPosts()).toHaveLength(1);
  });

  test('shows a persisted-list 500 error without replacing session results', async () => {
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/versions')) {
        return json({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname.endsWith('/reports')) {
        return json({ success: false, message: 'Report list exploded' }, 500);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderResults({ runtimeConfig });
    expect(await screen.findByRole('alert')).toHaveTextContent('Report list exploded');
    await userEvent.click(screen.getByRole('tab', { name: '会话结果' }));
    expect(screen.getByRole('table', { name: '最近报告' })).toBeInTheDocument();
  });

  test('owns the approved spacious typography, elastic geometry, and shell-safe mobile modal', () => {
    const cssPath = 'src/styles/routes/results.css';
    expect(existsSync(cssPath)).toBe(true);
    if (!existsSync(cssPath)) {
      return;
    }
    const resultsCss = readFileSync(cssPath, 'utf8');

    expect(resultsCss).toMatch(/\.results-filter-panel\s*\{[^}]*gap:\s*16px;[^}]*padding:\s*24px;/);
    expect(resultsCss).toMatch(
      /\.results-filter-panel\s+label,\s*\.report-generation-fields\s+label\s*\{[^}]*gap:\s*8px;[^}]*font-size:\s*13px;[^}]*line-height:\s*20px;/
    );
    expect(resultsCss).toMatch(
      /\.results-filter-panel\s+input,[\s\S]*?\.report-generation-fields\s+select\s*\{[^}]*min-height:\s*48px;[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/
    );
    expect(resultsCss).toMatch(
      /\.results-filter-panel\s+small,\s*\.report-generation-fields\s+small\s*\{[^}]*font-size:\s*12px;[^}]*line-height:\s*18px;[^}]*overflow-wrap:\s*anywhere;/
    );
    expect(resultsCss).toMatch(
      /\.results-page\s*>\s*\.page-header\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*110px;[^}]*margin-bottom:\s*24px;/
    );
    expect(resultsCss).toMatch(
      /\.results-metrics\s*\{[^}]*min-height:\s*132px;[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*16px;[^}]*margin-bottom:\s*24px;/
    );
    expect(resultsCss).toMatch(/\.results-metric-card\s*\{[^}]*min-height:\s*132px;[^}]*padding:\s*22px\s+24px;/);
    expect(resultsCss).toMatch(
      /\.results-chart-grid\s*\{[^}]*grid-template-columns:\s*760px\s+512px;[^}]*min-height:\s*270px;[^}]*gap:\s*24px;/
    );
    expect(resultsCss).toMatch(/\.results-chart-card\s*\{[^}]*min-height:\s*270px;[^}]*gap:\s*16px;[^}]*padding:\s*24px;/);
    expect(resultsCss).toMatch(
      /\.results-card-heading\s+h2,\s*\.results-reports-heading\s+h2\s*\{[^}]*font-size:\s*20px;[^}]*line-height:\s*28px;/
    );
    expect(resultsCss).toMatch(
      /\.results-trend-chart\s*\{[^}]*width:\s*712px;[^}]*min-height:\s*176px;[^}]*grid-template-columns:\s*repeat\(7,\s*90px\);[^}]*gap:\s*12px;/
    );
    expect(resultsCss).not.toMatch(/\.results-trend-chart\s*\{[^}]*min-height:\s*176px;[^}]*min-height:\s*0;/);
    expect(resultsCss).toMatch(
      /\.results-failure-list\s+li\s*\{[^}]*min-height:\s*42px;[^}]*row-gap:\s*8px;/
    );
    expect(resultsCss).toMatch(
      /\.results-failure-label,\s*\.results-failure-list\s+strong\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/
    );
    expect(resultsCss).toMatch(/\.results-reports-card\s*\{[^}]*min-height:\s*444px;[^}]*gap:\s*16px;[^}]*padding:\s*24px\s+28px;/);
    expect(resultsCss).toMatch(/\.results-report-tabs\s*\{[^}]*min-height:\s*48px;/);
    expect(resultsCss).toMatch(/\.results-report-tabs\s+button\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/);
    expect(resultsCss).toMatch(/\.results-report-search\s*\{[^}]*height:\s*48px;[^}]*min-height:\s*48px;/);
    expect(resultsCss).toMatch(/\.results-table-scroll\s*\{[^}]*min-height:\s*320px;[^}]*flex:\s*1\s+1\s+320px;/);
    expect(resultsCss).toMatch(
      /\.results-reports-card\s+table\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/
    );
    expect(resultsCss).toMatch(/\.results-reports-card\s+thead\s+tr\s*\{[^}]*min-height:\s*44px;/);
    expect(resultsCss).toMatch(/\.results-reports-card\s+tbody\s+tr\s*\{[^}]*min-height:\s*64px;[^}]*padding-block:\s*10px;/);
    expect(resultsCss).toMatch(
      /\.results-report-title,\s*\.results-report-id,\s*\.results-report-version\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*break-word;/
    );
    expect(resultsCss).toMatch(/\.results-pagination\s+button\s*\{[^}]*min-height:\s*44px;/);
    expect(resultsCss).toMatch(/\.report-modal-backdrop\s*\{[^}]*inset:\s*72px\s+0\s+0;/);
    expect(resultsCss).toMatch(/\.report-generation-modal\s*\{[^}]*gap:\s*24px;/);
    expect(resultsCss).toMatch(/\.report-generation-lede\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;[^}]*overflow-wrap:\s*anywhere;/);
    expect(resultsCss).toMatch(/\.report-generation-fields\s*\{[^}]*gap:\s*16px;/);
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*1439px\)[\s\S]*?\.results-table-scroll\s*\{[^}]*width:\s*calc\(100%\s*\+\s*2px\);[^}]*max-width:\s*calc\(100%\s*\+\s*2px\);[^}]*overflow-x:\s*auto;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*?\.results-chart-grid\s*\{[^}]*height:\s*auto;[\s\S]*?\.results-trend-card,[\s\S]*?\.results-failure-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.results-metrics\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?\.results-header-actions[\s\S]*?min-height:\s*48px;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.report-modal-backdrop\s*\{[^}]*padding:\s*0;[^}]*place-items:\s*stretch;[\s\S]*?\.report-generation-modal\s*\{[^}]*height:\s*100%;[^}]*max-height:\s*100%;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.report-generation-modal\s*>\s*header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[\s\S]*?\.report-generation-modal\s*>\s*footer\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;/
    );
  });
});
