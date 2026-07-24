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

interface DashboardRenderOptions {
  language?: Language;
  task?: NormalizedTaskStatus | null;
  runtimeConfig?: RuntimeConfig;
  selectedSut?: SutTarget;
}

function dashboardElement({
  language = 'zh',
  task = activeTask,
  runtimeConfig = resolveRuntimeConfig({ defaultLanguage: language, enableMockFallback: true }),
  selectedSut = runtimeConfig.sutTargets[0]
}: DashboardRenderOptions = {}) {
  return (
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

function renderDashboard(options: DashboardRenderOptions = {}) {
  return render(dashboardElement(options));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Overview dashboard R10', () => {
  test('encodes the approved flexible desktop geometry, hierarchy gap, and single-line action', () => {
    expect(foundationStyles).toMatch(/--radius-card:\s*24px;/);
    expect(primitiveStyles).toMatch(
      /\.main-content\s*\{[^}]*max-width:\s*1440px;[^}]*padding:\s*48px 72px 80px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-create-task\s*\{[^}]*width:\s*120px;[^}]*height:\s*auto;[^}]*min-width:\s*120px;[^}]*min-height:\s*52px;[^}]*white-space:\s*nowrap;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-hierarchy\s*\{[^}]*gap:\s*48px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-l0-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*252px;[^}]*grid-template-columns:\s*300px 1px minmax\(0,\s*1fr\);/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-ring\.is-large\s*\{[^}]*width:\s*124px;[^}]*height:\s*148px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-ring\.is-compact\s*\{[^}]*width:\s*116px;[^}]*height:\s*140px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-ring__caption\s*\{[^}]*font-size:\s*13px;[^}]*line-height:\s*20px;[^}]*white-space:\s*normal;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-ring__visual strong\s*\{[^}]*font-size:\s*28px;[^}]*letter-spacing:\s*0;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-l1-card\s*\{[^}]*min-height:\s*350px;/s
    );
    expect(overviewStyles).toMatch(
      /\.dimension-selector\s*\{[^}]*width:\s*232px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-l1-card__controls\s*\{[^}]*display:\s*flex;[^}]*gap:\s*12px;/s
    );
    expect(overviewStyles).toMatch(
      /\.version-selector\s*\{[^}]*width:\s*176px;/s
    );
    expect(overviewStyles).toMatch(
      /\.dimension-summary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(overviewStyles).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*?\.overview-l0-divider\s*\{[^}]*width:\s*100%;[^}]*height:\s*1px;[^}]*min-height:\s*1px;/s
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

  test('keeps Dashboard metadata readable and lets long copy expand instead of clipping', () => {
    const pixelFontSizes = [...overviewStyles.matchAll(/font-size:\s*(\d+)px;/g)]
      .map((match) => Number(match[1]));

    expect(pixelFontSizes.length).toBeGreaterThan(0);
    expect(Math.min(...pixelFontSizes)).toBeGreaterThanOrEqual(12);
    expect(overviewStyles).toMatch(
      /\.overview-hierarchy-heading p,[\s\S]*?font-size:\s*13px;[\s\S]*?line-height:\s*20px;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?white-space:\s*normal;/
    );
    expect(overviewStyles).toMatch(
      /\.overview-status-pill\s*\{[^}]*min-height:\s*28px;[^}]*font-size:\s*12px;[^}]*line-height:\s*18px;[^}]*white-space:\s*normal;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-current-run\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*96px;/s
    );
    expect(overviewStyles).toMatch(
      /\.dimension-summary-zone\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*240px;/s
    );
    expect(overviewStyles).toMatch(
      /\.dimension-conclusion,[^}]*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s
    );
  });

  test('renders the approved hierarchy and removes obsolete Overview sections', () => {
    renderDashboard();

    const pageTitle = screen.getByRole('heading', { name: '测试看板', level: 1 });
    expect(screen.getByText('产品级 L0 质量总览与 L1 分维度测试执行分析')).toBeInTheDocument();
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

  test('integrates product-and-version L0 execution, pass rate, and issue totals', () => {
    renderDashboard();

    const l0 = screen.getByRole('region', { name: '全局质量' });
    const metrics = within(l0).getAllByRole('listitem');

    expect(metrics).toHaveLength(3);
    expect(within(metrics[0]).getAllByText('总执行次数').length).toBeGreaterThan(0);
    expect(within(metrics[0]).getByText('134')).toBeInTheDocument();
    expect(within(metrics[1]).getAllByText('整体通过率').length).toBeGreaterThan(0);
    expect(within(metrics[1]).getByText('67.91%')).toBeInTheDocument();
    expect(within(metrics[2]).getAllByText('问题总数').length).toBeGreaterThan(0);
    expect(within(metrics[2]).getByText('42')).toBeInTheDocument();
    expect(within(metrics[2]).getByText('演示问题数据 · 前端模拟')).toBeInTheDocument();
    expect(screen.getByText('演示数据 · 前端模拟')).toBeInTheDocument();

    const overallRing = screen.getByRole('img', { name: '综合质量 67.91' });
    expect(within(overallRing).getByText('综合质量')).toHaveClass('overview-quality-ring__caption');
    expect(overallRing.querySelector('.overview-quality-ring__visual')).not.toHaveTextContent('综合质量');
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

  test('uses canonical taxonomy in the accessible current-Object label', () => {
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'en', enableMockFallback: true });
    const selectedSut: SutTarget = {
      ...runtimeConfig.sutTargets[0],
      name: '合一版本 场景用例',
      product: '合一版本',
      scene: '场景用例',
      version: 'catalog-r1'
    };

    renderDashboard({ language: 'en', runtimeConfig, selectedSut });

    const currentRun = screen.getByRole('region', { name: 'Active run' });
    expect(within(currentRun).getByText('Unified Version Scene · catalog-r1'))
      .toHaveClass('sr-only');
    expect(within(currentRun).queryByText('合一版本 场景用例 · catalog-r1'))
      .not.toBeInTheDocument();
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

  test('resolves distinct L0 and L1 fixtures for all three native products', () => {
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
    const cases = [
      { product: '高码java', version: 'v2.4.1', score: '67.91', passed: '91' },
      { product: '高码python', version: 'v1.8.0', score: '87.93', passed: '102' },
      { product: '合一版本', version: 'v3.0.0', score: '94.05', passed: '158' }
    ] as const;
    const firstSut = runtimeConfig.sutTargets.find(({ product }) => product === cases[0].product)!;
    const { rerender } = renderDashboard({ runtimeConfig, selectedSut: firstSut });

    for (const fixture of cases) {
      const selectedSut = runtimeConfig.sutTargets.find(
        ({ product }) => product === fixture.product
      )!;
      rerender(dashboardElement({ runtimeConfig, selectedSut }));

      expect(screen.getByRole('img', { name: `综合质量 ${fixture.score}` }))
        .toBeInTheDocument();
      expect(screen.getByRole('button', { name: `选择版本: ${fixture.version}` }))
        .toBeInTheDocument();
      expect(
        within(screen.getByRole('region', { name: '通过的测试脚本' }))
          .getByText(fixture.passed)
      ).toBeInTheDocument();
    }
  });

  test('switching version updates L0, every L1 dimension, and the performance fixture', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: '选择版本: v2.4.1' }));
    const versionListbox = screen.getByRole('listbox', { name: '选择版本' });
    expect(within(versionListbox).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['v2.4.1', 'v2.3.0']);
    await user.click(within(versionListbox).getByRole('option', { name: 'v2.3.0' }));

    expect(screen.getByRole('img', { name: '综合质量 60.94' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '通过的测试脚本' })).getByText('78')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择质量维度: 基础功能' }));
    await user.click(screen.getByRole('option', { name: 'DFX' }));
    expect(
      within(screen.getByRole('region', { name: '通过的测试脚本' })).getByText('104')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择质量维度: DFX' }));
    await user.click(screen.getByRole('option', { name: '场景化测试' }));
    expect(
      within(screen.getByRole('region', { name: '通过的测试脚本' })).getByText('90')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择质量维度: 场景化测试' }));
    await user.click(screen.getByRole('option', { name: '性能' }));
    expect(screen.getAllByText('488 ms')).toHaveLength(2);
    expect(screen.getByText('521 ms')).toBeInTheDocument();
    expect(screen.getByText('通过 75 / 128')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择版本: v2.3.0' }));
    await user.click(screen.getByRole('option', { name: 'v2.4.1' }));
    expect(screen.getByRole('img', { name: '综合质量 67.91' })).toBeInTheDocument();
    expect(screen.getAllByText('412 ms')).toHaveLength(2);
    expect(screen.queryByText('521 ms')).not.toBeInTheDocument();
  });

  test('remembers a valid version independently for each product', async () => {
    const user = userEvent.setup();
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
    const javaSut = runtimeConfig.sutTargets.find(({ product }) => product === '高码java')!;
    const pythonSut = runtimeConfig.sutTargets.find(({ product }) => product === '高码python')!;
    const { rerender } = renderDashboard({ runtimeConfig, selectedSut: javaSut });

    await user.click(screen.getByRole('button', { name: '选择版本: v2.4.1' }));
    await user.click(screen.getByRole('option', { name: 'v2.3.0' }));

    rerender(dashboardElement({ runtimeConfig, selectedSut: pythonSut }));
    expect(screen.getByRole('button', { name: '选择版本: v1.8.0' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '选择版本: v1.8.0' }));
    await user.click(screen.getByRole('option', { name: 'v1.7.2' }));

    rerender(dashboardElement({ runtimeConfig, selectedSut: javaSut }));
    expect(screen.getByRole('button', { name: '选择版本: v2.3.0' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '综合质量 60.94' })).toBeInTheDocument();

    rerender(dashboardElement({ runtimeConfig, selectedSut: pythonSut }));
    expect(screen.getByRole('button', { name: '选择版本: v1.7.2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '综合质量 80.77' })).toBeInTheDocument();
  });

  test('renders an explicit neutral state for an unsupported product without fixture fallback', () => {
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
    const selectedSut: SutTarget = {
      ...runtimeConfig.sutTargets[0],
      id: 'unknown-product',
      name: '未知产品 API',
      product: '未知产品',
      scene: 'API'
    };

    renderDashboard({ runtimeConfig, selectedSut });

    const status = screen.getByRole('status');
    expect(within(status).getByRole('heading', { name: '暂无该产品的质量数据' }))
      .toBeInTheDocument();
    expect(within(status).getByText('请选择支持的产品后重试。')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '全局质量' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /选择版本/ })).not.toBeInTheDocument();
    expect(screen.queryByText('67.91%')).not.toBeInTheDocument();
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
    const passed = screen.getByRole('region', { name: '通过的测试脚本' });
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

  test('supports keyboard navigation and focus return in the version selector', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const trigger = screen.getByRole('button', { name: '选择版本: v2.4.1' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    const previousVersion = await screen.findByRole('option', { name: 'v2.3.0' });
    await waitFor(() => expect(previousVersion).toHaveFocus());
    await user.keyboard('{Enter}');

    const previousTrigger = screen.getByRole('button', { name: '选择版本: v2.3.0' });
    await waitFor(() => expect(previousTrigger).toHaveFocus());
    expect(previousTrigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(previousTrigger);
    await waitFor(() => expect(screen.getByRole('option', { name: 'v2.3.0' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: '选择版本' })).not.toBeInTheDocument();
    await waitFor(() => expect(previousTrigger).toHaveFocus());
  });

  test('contains no locale-insensitive Overview taxonomy when Chinese is active', () => {
    renderDashboard();

    expect(document.body).not.toHaveTextContent(
      /BASIC FUNCTIONALITY|SCENARIO-BASED|PASSED TEST SCRIPTS|OVERALL QUALITY ASSESSMENT|ISSUES FOUND|VERSION BASELINE|TOTAL EXECUTION|OVERALL PASS RATE|TOTAL ISSUES|DIMENSION VIEW/
    );
    expect(screen.getByText('L0 质量 · 产品')).toBeInTheDocument();
    expect(screen.getByText('L1 质量 · 维度视图')).toBeInTheDocument();
    expect(screen.getByText('通过的测试脚本')).toBeInTheDocument();
    expect(screen.getByText('整体质量评估')).toBeInTheDocument();
    expect(screen.getByText('发现问题')).toBeInTheDocument();
  });

  test('renders Scenario-Based with the same three information zones', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /选择质量维度/ }));
    await user.click(screen.getByRole('option', { name: '场景化测试' }));

    expect(screen.getByRole('heading', { name: '场景化测试', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '通过的测试脚本' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '整体质量评估' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '发现问题' })).toBeInTheDocument();
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
    for (const version of ['v2.0.0', 'v2.1.0', 'v2.2.0', 'v2.3.0', 'v2.4.0', 'v2.4.1']) {
      expect(screen.getAllByText(version).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('412 ms')).toHaveLength(2);
    expect(screen.getByText('450 ms')).toBeInTheDocument();
    expect(screen.getByText(/较基线优化 38 ms · -8.4%/)).toBeInTheDocument();
    expect(screen.getByText('通过 86 / 134')).toBeInTheDocument();
    expect(screen.getByText('评级 B-')).toBeInTheDocument();
    expect(screen.getByText('问题 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择质量维度: 性能' }));
    await user.click(screen.getByRole('option', { name: '基础功能' }));
    expect(screen.queryByRole('img', { name: /性能趋势/ })).not.toBeInTheDocument();
    expect(screen.queryByText('450 ms')).not.toBeInTheDocument();
  });

  test('provides professional English terminology when language is switched', () => {
    renderDashboard({ language: 'en' });

    expect(screen.getByText('Product-level L0 quality overview and L1 dimension-specific test execution analysis.'))
      .toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Global quality' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dimension-level quality assessment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select quality dimension: Basic Functionality' }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select version: v2.4.1' }))
      .toBeInTheDocument();
    const overallRing = screen.getByRole('img', { name: 'Overall quality 67.91' });
    expect(within(overallRing).getByText('Overall quality')).toHaveClass('overview-quality-ring__caption');
    expect(overallRing.querySelector('.overview-quality-ring__visual')).not.toHaveTextContent('Overall quality');
  });
});
