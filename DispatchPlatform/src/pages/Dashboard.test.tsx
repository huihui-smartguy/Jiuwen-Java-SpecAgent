import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import { activeTask } from '../data/mockData';
import type { NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';
import { Dashboard } from './Dashboard';

function renderDashboard({
  task = activeTask,
  runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true }),
  selectedSut = runtimeConfig.sutTargets[0]
}: {
  task?: NormalizedTaskStatus;
  runtimeConfig?: RuntimeConfig;
  selectedSut?: SutTarget;
} = {}) {
  return render(
    <MemoryRouter>
      <Dashboard
        language="zh"
        selectedSut={selectedSut}
        activeTask={task}
        runtimeConfig={runtimeConfig}
      />
    </MemoryRouter>
  );
}

describe('Overview dashboard', () => {
  test('renders the approved Overview composition in source order', () => {
    const { container } = renderDashboard();

    const pageTitle = screen.getByRole('heading', { name: '测试看板', level: 1 });
    expect(screen.getByText('执行态势、质量信号与需要处理的异常，一屏完成判断。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /新建任务/ })).toHaveAttribute('href', '/tasks');

    const currentRun = screen.getByRole('region', { name: '当前执行' });
    const quality = screen.getByRole('region', { name: '质量摘要' });
    const executionPath = screen.getByRole('region', { name: '执行路径' });
    const recentActivity = screen.getByRole('region', { name: '最近活动' });
    const attention = screen.getByRole('complementary', { name: '需要关注' });

    for (const [earlier, later] of [
      [pageTitle, currentRun],
      [currentRun, quality],
      [quality, executionPath],
      [executionPath, recentActivity],
      [recentActivity, attention]
    ]) {
      expect(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    expect(container.querySelector('.page-header .eyebrow')).not.toBeInTheDocument();
    expect(screen.queryByText(/TESTWISE CONTROL PLANE/i)).not.toBeInTheDocument();
    expect(screen.queryByText('执行焦点')).not.toBeInTheDocument();
    expect(screen.queryByText('L0 质量摘要')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.overview-quality-card')).toHaveLength(1);
    expect(container.querySelectorAll('.quality-card')).toHaveLength(0);
  });

  test('binds the current-run strip to the real task and selected Object', () => {
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: true });
    const selectedSut = runtimeConfig.sutTargets[1];
    const task: NormalizedTaskStatus = {
      ...activeTask,
      task_id: 'task_live_20260714',
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
    expect(within(currentRun).getByText(`${selectedSut.name} · ${selectedSut.version}`)).toBeInTheDocument();
    expect(within(currentRun).getByRole('progressbar', { name: '进度' })).toHaveAttribute(
      'aria-valuenow',
      '3'
    );
    expect(within(currentRun).getByRole('link', { name: /打开观测台/ })).toHaveAttribute(
      'href',
      '/observation'
    );
    expect(within(currentRun).queryByText(activeTask.task_id)).not.toBeInTheDocument();
  });

  test('counts failed terminal commands as completed progress', () => {
    const task: NormalizedTaskStatus = {
      ...activeTask,
      status: 'failed',
      uiStatus: 'failed',
      isTerminal: true,
      progress: undefined,
      result: {
        total_commands: 5,
        success_count: 3,
        failed_count: 2
      }
    };

    renderDashboard({ task });

    const currentRun = screen.getByRole('region', { name: '当前执行' });
    expect(within(currentRun).getByText('5 / 5')).toBeInTheDocument();
    expect(within(currentRun).getByRole('progressbar', { name: '进度' })).toHaveAttribute(
      'aria-valuenow',
      '5'
    );
  });

  test('surfaces a normalized polling error instead of stale backend status', () => {
    const task: NormalizedTaskStatus = {
      ...activeTask,
      uiStatus: 'polling_error'
    };

    renderDashboard({ task });

    expect(within(screen.getByRole('region', { name: '当前执行' })).getByText(/轮询异常/))
      .toBeInTheDocument();
  });

  test('shows the approved mock quality, metrics, path, and activity values', () => {
    const { container } = renderDashboard();

    const quality = screen.getByRole('region', { name: '质量摘要' });
    expect(within(quality).getByText('93.6')).toBeInTheDocument();
    expect(within(quality).getAllByRole('listitem').map((item) => (
      within(item).getByRole('heading', { level: 3 }).textContent
    ))).toEqual(['基本功能', '性能测试', '场景化', 'DFX 测试']);

    const metrics = container.querySelectorAll('.overview-metric-card');
    expect(metrics).toHaveLength(3);
    expect(Array.from(metrics).map((metric) => within(metric as HTMLElement).getByTestId('metric-value').textContent))
      .toEqual(['24', '93.6%', '7']);

    const executionPath = screen.getByRole('region', { name: '执行路径' });
    const stages = within(executionPath).getAllByRole('listitem');
    expect(stages.map((item) => within(item).getByTestId('path-stage-label').textContent)).toEqual([
      '环境检查',
      '脚本准备',
      '保存接口',
      '查询接口',
      '汇总'
    ]);
    expect(stages[2]).toHaveAttribute('aria-current', 'step');
    expect(within(stages[0]).getByText('已完成')).toHaveClass('sr-only');
    expect(within(stages[2]).getByText('当前阶段')).toHaveClass('sr-only');
    expect(within(stages[4]).getByText('待执行')).toHaveClass('sr-only');

    const recentActivity = screen.getByRole('region', { name: '最近活动' });
    expect(within(recentActivity).getAllByRole('listitem')).toHaveLength(3);
    expect(within(recentActivity).getByText('保存接口任务已发起')).toBeInTheDocument();
    expect(within(recentActivity).getByText('17 个回归已完成并生成摘要')).toBeInTheDocument();
    expect(within(recentActivity).getByText('执行日志已导出')).toBeInTheDocument();
  });

  test('keeps presentation-only affordances focusable, disabled to assistive tech, and inert', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const viewAll = screen.getByRole('button', { name: '查看全部' });
    const interactionGuide = screen.getByRole('button', { name: '查看交互说明' });

    for (const button of [viewAll, interactionGuide]) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled();
      button.focus();
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
    }

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '测试看板' })).toBeInTheDocument();
  });

  test('does not present approved sample data when mock fallback is disabled', () => {
    const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'zh', enableMockFallback: false });
    const { container } = renderDashboard({ runtimeConfig });

    expect(screen.queryByText('93.6')).not.toBeInTheDocument();
    expect(screen.queryByText('93.6%')).not.toBeInTheDocument();
    expect(screen.queryByText('稳定')).not.toBeInTheDocument();
    expect(screen.queryByText('保存接口任务已发起')).not.toBeInTheDocument();
    expect(screen.queryByText('环境检查')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.overview-metric-card')).toHaveLength(3);
    expect(screen.getByText(activeTask.task_id)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});
