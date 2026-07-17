import { readFileSync } from 'node:fs';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import { activeTask } from '../data/mockData';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';
import { Dashboard } from './Dashboard';

const overviewStyles = readFileSync('src/styles/routes/overview.css', 'utf8');
const foundationStyles = readFileSync('src/styles/foundations.css', 'utf8');
const primitiveStyles = readFileSync('src/styles/primitives.css', 'utf8');

function renderDashboard({
  language = 'zh',
  task = activeTask,
  runtimeConfig = resolveRuntimeConfig({ defaultLanguage: language, enableMockFallback: true }),
  selectedSut = runtimeConfig.sutTargets[0]
}: {
  language?: Language;
  task?: NormalizedTaskStatus | null;
  runtimeConfig?: RuntimeConfig;
  selectedSut?: SutTarget;
} = {}) {
  return render(
    <MemoryRouter>
      <Dashboard
        language={language}
        selectedSut={selectedSut}
        activeTask={task}
        runtimeConfig={runtimeConfig}
      />
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Overview dashboard R6', () => {
  test('encodes the approved desktop geometry, hierarchy gap, and single-line action', () => {
    expect(foundationStyles).toMatch(/--radius-card:\s*24px;/);
    expect(primitiveStyles).toMatch(
      /\.main-content\s*\{[^}]*max-width:\s*1440px;[^}]*padding:\s*48px 72px 80px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-create-task\s*\{[^}]*width:\s*120px;[^}]*height:\s*52px;[^}]*min-width:\s*120px;[^}]*white-space:\s*nowrap;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-hierarchy\s*\{[^}]*gap:\s*48px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-l0-card\s*\{[^}]*height:\s*210px;[^}]*grid-template-columns:\s*300px 1px minmax\(0,\s*1fr\);/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-l1-card\s*\{[^}]*min-height:\s*350px;/s
    );
    expect(overviewStyles).toMatch(
      /\.dimension-selector\s*\{[^}]*width:\s*232px;/s
    );
    expect(overviewStyles).toMatch(
      /\.dimension-summary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(overviewStyles).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.overview-create-task\s*\{[^}]*flex:\s*0 0 auto;[^}]*min-height:\s*52px;/s
    );
    expect(overviewStyles).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.overview-mock-badge\s*\{[^}]*flex:\s*0 0 auto;[^}]*align-self:\s*flex-start;/s
    );
    expect(overviewStyles).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*?\.overview-l1-card\s*\{[^}]*grid-template-rows:\s*auto 1px auto;[^}]*gap:\s*14px;/s
    );
  });

  test('renders the approved hierarchy and removes obsolete Overview sections', () => {
    renderDashboard();

    const pageTitle = screen.getByRole('heading', { name: '测试看板', level: 1 });
    expect(screen.getByText('对象级 L0 质量总览与 L1 分维度测试执行分析')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /新建任务/ })).toHaveAttribute('href', '/tasks');

    const currentRun = screen.getByRole('region', { name: '当前执行' });
    const l0 = screen.getByRole('region', { name: '全局质量' });
    const l1 = screen.getByRole('region', { name: '分维度质量评估' });

    for (const [earlier, later] of [[pageTitle, currentRun], [currentRun, l0], [l0, l1]]) {
      expect(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    expect(screen.queryByRole('region', { name: '执行路径' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '最近活动' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '需要关注' })).not.toBeInTheDocument();
    expect(screen.queryByText('今日执行')).not.toBeInTheDocument();
    expect(screen.queryByText('活动问题')).not.toBeInTheDocument();
  });

  test('integrates object-wide L0 execution, pass rate, and issue totals', () => {
    renderDashboard();

    const l0 = screen.getByRole('region', { name: '全局质量' });
    const metrics = within(l0).getAllByRole('listitem');

    expect(metrics).toHaveLength(3);
    expect(within(metrics[0]).getByText('总执行次数')).toBeInTheDocument();
    expect(within(metrics[0]).getByText('134')).toBeInTheDocument();
    expect(within(metrics[1]).getByText('整体通过率')).toBeInTheDocument();
    expect(within(metrics[1]).getByText('67.91%')).toBeInTheDocument();
    expect(within(metrics[2]).getByText('问题总数')).toBeInTheDocument();
    expect(within(metrics[2]).getByText('42')).toBeInTheDocument();
    expect(within(metrics[2]).getByText('演示问题数据 · 前端模拟')).toBeInTheDocument();
    expect(screen.getByText('演示数据 · 前端模拟')).toBeInTheDocument();
  });

  test('keeps the current-execution strip bound to the real task and Object', () => {
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
    const selectedSut = runtimeConfig.sutTargets[1];
    const task: NormalizedTaskStatus = {
      ...activeTask,
      task_id: 'task_live_20260717',
      progress: {
        total_commands: 8,
        completed: 3,
        failed: 0,
        current_command: 'pytest testcase/live_save'
      }
    };

    renderDashboard({ task, runtimeConfig, selectedSut });

    const currentRun = screen.getByRole('region', { name: '当前执行' });
    expect(within(currentRun).getByText(task.task_id)).toBeInTheDocument();
    expect(within(currentRun).getByText('3 / 8')).toBeInTheDocument();
    expect(within(currentRun).getByText('pytest testcase/live_save')).toBeInTheDocument();
    expect(within(currentRun).getByText(`${selectedSut.name} · ${selectedSut.version}`)).toHaveClass('sr-only');
    expect(within(currentRun).getByRole('progressbar', { name: '进度' })).toHaveAttribute('aria-valuenow', '3');
    expect(within(currentRun).getByRole('link', { name: /打开观测台/ })).toHaveAttribute('href', '/observation');
  });

  test('counts failed terminal commands and preserves polling-error truthfulness', () => {
    const failedTask: NormalizedTaskStatus = {
      ...activeTask,
      status: 'failed',
      uiStatus: 'failed',
      isTerminal: true,
      progress: undefined,
      result: { total_commands: 5, success_count: 3, failed_count: 2 }
    };
    const { rerender } = renderDashboard({ task: failedTask });

    expect(within(screen.getByRole('region', { name: '当前执行' })).getByText('5 / 5')).toBeInTheDocument();

    const pollingTask = { ...activeTask, uiStatus: 'polling_error' as const };
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
    rerender(
      <MemoryRouter>
        <Dashboard
          language="zh"
          selectedSut={runtimeConfig.sutTargets[0]}
          activeTask={pollingTask}
          runtimeConfig={runtimeConfig}
        />
      </MemoryRouter>
    );
    expect(within(screen.getByRole('region', { name: '当前执行' })).getByText(/轮询异常/)).toBeInTheDocument();
  });

  test('uses the labelled frontend mock in production mode without a statistics request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: false });

    renderDashboard({ runtimeConfig, task: null });
    await Promise.resolve();

    expect(screen.getByText('演示数据 · 前端模拟')).toBeInTheDocument();
    expect(screen.getByText('67.91%')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    const currentRun = screen.getByRole('region', { name: '当前执行' });
    expect(within(currentRun).getByText('暂无活动任务')).toBeInTheDocument();
    expect(within(currentRun).getByText('0 / 0')).toBeInTheDocument();
  });

  test('opens an accessible four-option selector and updates standard dimensions', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const trigger = screen.getByRole('button', { name: '选择质量维度: 基础功能' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: '选择质量维度' });
    const options = within(listbox).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['基础功能', 'DFX', '场景化测试', '性能']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.click(within(listbox).getByRole('option', { name: 'DFX' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'DFX', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择质量维度: DFX' })).toHaveAttribute('aria-expanded', 'false');
    const passed = screen.getByRole('region', { name: /PASSED TEST SCRIPTS/ });
    expect(within(passed).getByText('118')).toBeInTheDocument();
    expect(screen.getByText(/质量属性总体受控，可靠性问题需收敛/)).toBeInTheDocument();
  });

  test('supports arrow selection, Escape, and trigger focus return', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const trigger = screen.getByRole('button', { name: '选择质量维度: 基础功能' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const dfxOption = await screen.findByRole('option', { name: 'DFX' });
    await waitFor(() => expect(dfxOption).toHaveFocus());
    await user.keyboard('{Enter}');
    const dfxTrigger = screen.getByRole('button', { name: '选择质量维度: DFX' });
    await waitFor(() => expect(dfxTrigger).toHaveFocus());

    await user.click(dfxTrigger);
    await waitFor(() => expect(screen.getByRole('option', { name: 'DFX' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await waitFor(() => expect(dfxTrigger).toHaveFocus());
  });

  test('renders Scenario-Based with the same three information zones', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /选择质量维度/ }));
    await user.click(screen.getByRole('option', { name: '场景化测试' }));

    expect(screen.getByRole('heading', { name: '场景化测试', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /PASSED TEST SCRIPTS/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /OVERALL QUALITY ASSESSMENT/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /ISSUES FOUND/ })).toBeInTheDocument();
    expect(screen.getByText(/核心链路可用，复杂场景覆盖仍需加强/)).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  test('adds the six-version trend and baseline comparison only for Performance', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /选择质量维度/ }));
    await user.click(screen.getByRole('option', { name: '性能' }));

    expect(screen.getByRole('heading', { name: '性能', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /性能趋势 · 最近 6 个版本/ })).toBeInTheDocument();
    for (const version of ['v1.0', 'v1.1', 'v1.2', 'v1.3', 'v1.4', 'v1.5']) {
      expect(screen.getByText(version)).toBeInTheDocument();
    }
    expect(screen.getAllByText('412 ms')).toHaveLength(2);
    expect(screen.getByText('450 ms')).toBeInTheDocument();
    expect(screen.getByText(/较基线优化 38 ms · -8.4%/)).toBeInTheDocument();
    expect(screen.getByText('通过 86 / 134')).toBeInTheDocument();
    expect(screen.getByText('评级 A-')).toBeInTheDocument();
    expect(screen.getByText('问题 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择质量维度: 性能' }));
    await user.click(screen.getByRole('option', { name: '基础功能' }));
    expect(screen.queryByRole('img', { name: /性能趋势/ })).not.toBeInTheDocument();
    expect(screen.queryByText('450 ms')).not.toBeInTheDocument();
  });

  test('provides professional English terminology when language is switched', () => {
    renderDashboard({ language: 'en' });

    expect(screen.getByText('Object-level L0 quality overview and L1 dimension-specific test execution analysis.'))
      .toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Global quality' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dimension-level quality assessment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select quality dimension: Basic Functionality' }))
      .toBeInTheDocument();
  });
});
