import { existsSync, readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { normalizeTaskStatus } from '../api/client';
import { resolveRuntimeConfig } from '../config/runtime';
import { copy } from '../i18n';
import type { NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';
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
  runtimeConfig = mockRuntimeConfig,
  selectedSut = runtimeConfig.sutTargets[0],
  activeTask = null,
  sessionTasks = []
}: {
  runtimeConfig?: RuntimeConfig;
  selectedSut?: SutTarget;
  activeTask?: NormalizedTaskStatus | null;
  sessionTasks?: NormalizedTaskStatus[];
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/results']}>
      <Results
        language="zh"
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

    const metrics = screen.getByRole('region', { name: '结果指标' });
    expect(within(metrics).getAllByRole('article')).toHaveLength(4);
    expect(within(metrics).getAllByTestId('metric-value').map((value) => value.textContent)).toEqual([
      '42',
      '93.6%',
      '17',
      '05:48'
    ]);

    const trend = screen.getByRole('region', { name: '7 日通过率趋势' });
    expect(within(trend).getByText('+2.1%')).toBeInTheDocument();

    const failures = screen.getByRole('region', { name: '失败分布' });
    const failureRows = within(failures).getAllByRole('listitem');
    expect(failureRows).toHaveLength(4);
    expect(failureRows.map((row) => row.textContent)).toEqual([
      'API 密钥7',
      '用户权限5',
      '会话管理3',
      '其他2'
    ]);

    const reports = screen.getByRole('region', { name: '最近报告' });
    expect(within(reports).getByText('TRACEABLE ARTIFACTS')).toBeInTheDocument();
    expect(within(reports).getAllByRole('row')).toHaveLength(4);
    for (const expected of [
      'EXEC-2042',
      '合一版本 API',
      '96.2%',
      'Today · 10:42',
      'EXEC-2041',
      '高码 Python',
      '88.9%',
      'Today · 09:18',
      'EXEC-2039',
      '合一版本 Web',
      '94.7%',
      'Yesterday'
    ]) {
      expect(within(reports).getByText(expected)).toBeInTheDocument();
    }
    expect(within(reports).getAllByText('Success')).toHaveLength(2);
    expect(within(reports).getByText('Partial')).toBeInTheDocument();
  });

  test('keeps all three presentation controls focusable and completely inert', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderResults();

    const controls = [
      screen.getByRole('button', { name: '筛选' }),
      screen.getByRole('button', { name: /导出报告/ }),
      screen.getByRole('button', { name: /查看用例/ })
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

  test('exposes the approved seven-day trend as one meaningful non-interactive inline SVG', () => {
    renderResults();

    const trend = screen.getByRole('region', { name: '7 日通过率趋势' });
    const chart = within(trend).getByRole('img', { name: /7 日通过率趋势/ });
    expect(chart.tagName.toLowerCase()).toBe('svg');
    expect(chart).toHaveAttribute('data-point-count', '7');
    expect(chart.querySelector('title')).toHaveTextContent('7 日通过率趋势');
    expect(chart.querySelector('desc')).toHaveTextContent(
      '07/08 91.5%，07/09 92.3%，07/10 92.9%，07/11 92.7%，07/12 93.2%，07/13 93.0%，07/14 93.6%'
    );
    expect(chart.querySelectorAll('path')).toHaveLength(2);
    expect(chart.querySelector('[tabindex], [role="button"]')).not.toBeInTheDocument();
    expect(within(trend).queryByRole('list')).not.toBeInTheDocument();
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
    expect(within(reports).getByText('87.5%')).toBeInTheDocument();
    expect(within(reports).getByText('75.0%')).toBeInTheDocument();
    expect(within(reports).queryByText('40.0%')).not.toBeInTheDocument();

    const failures = screen.getByRole('region', { name: '失败分布' });
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
      expectedResult: 'Success',
      expectedRate: '100.0%'
    },
    {
      id: 'mixed-result',
      overrides: {
        result: { total_commands: 4, success_count: 3, failed_count: 1 }
      },
      expectedResult: 'Partial',
      expectedRate: '75.0%'
    },
    {
      id: 'all-failed-completed',
      overrides: {
        backend_status: 'completed' as const,
        result: { total_commands: 4, success_count: 0, failed_count: 4 }
      },
      expectedResult: 'Failed',
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
      expectedResult: 'Cancelled',
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
      expectedResult: 'Running',
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
    expect(row!.querySelector('.results-pass-rate')).toHaveTextContent(expectedRate);
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
    expect(within(reports).getByText('Running')).toBeInTheDocument();
    expect(within(reports).getAllByText('—')).toHaveLength(2);
  });

  test('filters recent reports in memory without issuing a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderResults();

    const reports = screen.getByRole('region', { name: '最近报告' });
    const search = within(reports).getByRole('searchbox', { name: '搜索任务或创建人' });
    expect(within(reports).getAllByRole('row')).toHaveLength(4);

    await user.type(search, '2041');

    expect(within(reports).getAllByRole('row')).toHaveLength(2);
    expect(within(reports).getByText('EXEC-2041')).toBeInTheDocument();
    expect(within(reports).queryByText('EXEC-2042')).not.toBeInTheDocument();
    expect(within(reports).queryByText('EXEC-2039')).not.toBeInTheDocument();
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
      /\.results-page\s*>\s*\.page-header\s*\{[^}]*margin-bottom:\s*24px;/
    );
    expect(resultsCss).toMatch(
      /\.results-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*18px;[^}]*margin-bottom:\s*18px;/
    );
    expect(resultsCss).toMatch(/\.results-metric-card\s*\{[^}]*height:\s*117px;/);
    expect(resultsCss).toMatch(
      /\.results-chart-grid\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\);[^}]*height:\s*276px;[^}]*gap:\s*18px;[^}]*margin-bottom:\s*18px;/
    );
    expect(resultsCss).toMatch(/\.results-trend-card\s*\{[^}]*grid-column:\s*span 7;/);
    expect(resultsCss).toMatch(/\.results-failure-card\s*\{[^}]*grid-column:\s*span 5;/);
    expect(resultsCss).toMatch(/\.results-reports-card\s*\{[^}]*height:\s*235px;/);
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*?\.results-chart-grid\s*\{[^}]*height:\s*auto;[\s\S]*?\.results-trend-card,[\s\S]*?\.results-failure-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/
    );
    expect(resultsCss).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.results-metrics\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?\.results-header-actions[\s\S]*?min-height:\s*44px;/
    );
  });
});
