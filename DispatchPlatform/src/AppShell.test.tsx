import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppShell } from './AppShell';
import { resolveRuntimeConfig } from './config/runtime';

function renderShell(initialPath = '/', runtimeOverrides = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell runtimeConfig={resolveRuntimeConfig(runtimeOverrides)} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppShell', () => {
  test('renders the redesigned dashboard without removed analytics', () => {
    renderShell();

    expect(screen.getByText('TestWise', { selector: '.brand strong' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /测试看板/i })).toBeInTheDocument();
    expect(screen.getByText(/执行焦点/i)).toBeInTheDocument();
    expect(screen.getByText(/L0 质量摘要/i)).toBeInTheDocument();
    expect(screen.queryByText(/五分类责任分流/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/基本功能质量矩阵/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DFX 维度雷达/i)).not.toBeInTheDocument();
  });

  test('keeps the SUT selector and search in the compact command rail', () => {
    renderShell();

    expect(screen.getByTestId('testwise-command-rail')).toBeInTheDocument();
    expect(screen.getByTestId('sut-command')).toBeInTheDocument();
    expect(screen.getByTestId('global-search-command')).toBeInTheDocument();
  });

  test('switches the product shell between Chinese and English', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /english/i }));

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/execution focus/i)).toBeInTheDocument();
  });

  test('SUT selector refreshes task creation context', async () => {
    const user = userEvent.setup();
    renderShell('/tasks');

    await user.click(screen.getByRole('tab', { name: /新建任务|new task/i }));
    await user.selectOptions(screen.getByLabelText(/SUT|被测系统/i), 'python-sut');

    const summary = screen.getByTestId('task-context-summary');
    expect(within(summary).getByText(/高码python/i)).toBeInTheDocument();
    expect(within(summary).getByText(/API/i)).toBeInTheDocument();
  });

  test('observation page shows current command and terminal-only log export', () => {
    renderShell('/observation');

    expect(screen.getByText(/pytest testcase\/save/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /导出日志/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
