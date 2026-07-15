import { existsSync, readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  return render(
    <MemoryRouter initialEntries={['/results']}>
      <Results
        language={language}
        selectedSut={selectedSut}
        activeTask={activeTask}
        sessionTasks={sessionTasks}
        runtimeConfig={runtimeConfig}
      />
      <LocationProbe />
    </MemoryRouter>
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
    expect(within(pageHeader as HTMLElement).getByRole('button', { name: '导出' })).toBeInTheDocument();
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
    expect(within(trend).queryByText(/全部级别|合一版本 API ·/)).not.toBeInTheDocument();

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
      '合一版本 API',
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
    expect(within(reports).getAllByText('合一版本 API')).toHaveLength(4);
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

  test('keeps all approved presentation controls focusable and completely inert', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderResults();

    const controls = [
      screen.getByRole('button', { name: '筛选' }),
      screen.getByRole('button', { name: /导出/ }),
      ...screen.getAllByRole('button', { name: /查看用例/ })
    ];

    for (const control of controls) {
      expect(control).toHaveAttribute('aria-disabled', 'true');
      expect(control).not.toBeDisabled();
      control.focus();
      expect(control).toHaveFocus();
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
    expect(within(failures).queryAllByRole('listitem')).toHaveLength(0);
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

  test('owns the approved desktop grid geometry and responsive source-order collapse', () => {
    const cssPath = 'src/styles/routes/results.css';
    expect(existsSync(cssPath)).toBe(true);
    if (!existsSync(cssPath)) {
      return;
    }
    const resultsCss = readFileSync(cssPath, 'utf8');

    expect(resultsCss).toMatch(
      /\.results-page\s*>\s*\.page-header\s*\{[^}]*height:\s*110px;[^}]*margin-bottom:\s*24px;/
    );
    expect(resultsCss).toMatch(
      /\.results-metrics\s*\{[^}]*height:\s*120px;[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*16px;[^}]*margin-bottom:\s*24px;/
    );
    expect(resultsCss).toMatch(/\.results-metric-card\s*\{[^}]*height:\s*120px;[^}]*padding:\s*18px\s+22px;/);
    expect(resultsCss).toMatch(
      /\.results-chart-grid\s*\{[^}]*grid-template-columns:\s*760px\s+512px;[^}]*height:\s*246px;[^}]*gap:\s*24px;[^}]*margin-bottom:\s*24px;/
    );
    expect(resultsCss).toMatch(
      /\.results-trend-chart\s*\{[^}]*width:\s*712px;[^}]*height:\s*160px;[^}]*grid-template-columns:\s*repeat\(7,\s*90px\);[^}]*gap:\s*12px;/
    );
    expect(resultsCss).toMatch(
      /\.results-trend-item\s*\{[^}]*width:\s*90px;[^}]*height:\s*160px;[^}]*gap:\s*8px;/
    );
    expect(resultsCss).toMatch(/\.results-trend-bar\s*\{[^}]*width:\s*24px;/);
    expect(resultsCss).toMatch(/\.results-failure-track\s*\{[^}]*height:\s*8px;/);
    expect(resultsCss).toMatch(
      /\.results-failure-list\s*\{[^}]*width:\s*calc\(100%\s*\+\s*2px\);[^}]*gap:\s*14px;[^}]*margin-top:\s*-1px;[^}]*margin-left:\s*-1px;/
    );
    expect(resultsCss).toMatch(
      /\.results-failure-list\s+li\s*\{[^}]*height:\s*34px;[^}]*row-gap:\s*8px;/
    );
    expect(resultsCss).toMatch(
      /\.results-failure-track\s*>\s*\.is-danger\s*\{[^}]*background:\s*#e5484d;/
    );
    expect(resultsCss).toMatch(
      /\.results-failure-track\s*>\s*\.is-warning\s*\{[^}]*background:\s*#b86e00;/
    );
    expect(resultsCss).toMatch(/\.results-reports-card\s*\{[^}]*height:\s*374px;[^}]*padding:\s*22px\s+28px\s+20px;/);
    expect(resultsCss).toMatch(
      /\.results-table-scroll\s*\{[^}]*width:\s*1240px;[^}]*height:\s*270px;/
    );
    expect(resultsCss).toMatch(
      /\.results-reports-card\s+thead\s+tr\s*\{[^}]*height:\s*38px;[^}]*grid-template-columns:\s*318px\s+198px\s+198px\s+170px\s+180px\s+152px;[^}]*border-radius:\s*10px;[^}]*background:\s*#e6eaf0;/
    );
    expect(resultsCss).toMatch(/\.results-reports-card\s+tbody\s+tr\s*\{[^}]*height:\s*58px;/);
    expect(resultsCss).toMatch(
      /\.results-reports-card\s+th,\s*\.results-reports-card\s+td\s*\{[^}]*border-bottom:\s*0;/
    );
    expect(resultsCss).toMatch(
      /\.results-report-id\s*\{[^}]*font-family:\s*inherit;[^}]*font-size:\s*13px;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*1439px\)[\s\S]*?\.results-table-scroll\s*\{[^}]*width:\s*calc\(100%\s*\+\s*2px\);[^}]*max-width:\s*calc\(100%\s*\+\s*2px\);[^}]*overflow-x:\s*auto;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*?\.results-chart-grid\s*\{[^}]*height:\s*auto;[\s\S]*?\.results-trend-card,[\s\S]*?\.results-failure-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.results-metrics\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?\.results-header-actions[\s\S]*?min-height:\s*44px;/
    );
  });
});
