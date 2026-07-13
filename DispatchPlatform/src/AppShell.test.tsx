import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  test('keeps TestWise exclusively in the top navigation and removes the unused search affordance', () => {
    renderShell('/', { defaultLanguage: 'en' });

    expect(screen.getAllByText('TestWise')).toHaveLength(1);
    expect(screen.getByRole('banner')).toHaveClass('app-header');
    expect(screen.getByRole('img', { name: /testwise gourd/i })).toBeInTheDocument();
    expect(screen.queryByText(/prototype mode/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search tasks/i)).not.toBeInTheDocument();
  });

  test('renders the data-first dashboard hierarchy without removed analytics', () => {
    renderShell();

    expect(screen.getByRole('heading', { name: /测试看板/i })).toBeInTheDocument();
    expect(screen.getByText(/执行焦点/i)).toBeInTheDocument();
    expect(screen.getByText(/L0 质量摘要/i)).toBeInTheDocument();
    expect(screen.queryByText(/五分类责任分流/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/基本功能质量矩阵/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DFX 维度雷达/i)).not.toBeInTheDocument();
  });

  test('uses the exact lowercase environment label and preserves environment health and selection', () => {
    renderShell('/', { defaultLanguage: 'en' });

    expect(screen.getByTestId('testwise-command-rail')).toBeInTheDocument();
    expect(screen.getByTestId('sut-command')).toHaveTextContent('environment');
    expect(screen.getByLabelText('environment')).toHaveValue('java-sut');
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  test('switches the product shell between Chinese and English', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /english/i }));

    expect(document.documentElement).toHaveClass('lang-en');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/execution focus/i)).toBeInTheDocument();
  });

  test('hands an open desktop menu directly to a sibling trigger and never shows an Enter glyph', () => {
    renderShell('/', { defaultLanguage: 'en' });
    const overview = screen.getByRole('button', { name: 'Overview' });
    const execute = screen.getByRole('button', { name: 'Execute' });

    fireEvent.pointerEnter(overview);
    expect(overview).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.pointerEnter(execute);
    expect(overview).toHaveAttribute('aria-expanded', 'false');
    expect(execute).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Run Details' })).toHaveAttribute('href', '/observation');
    expect(screen.queryByText(/^Enter$/i)).not.toBeInTheDocument();
  });

  test('supports click, arrow, Escape, and outside-close behavior for grouped navigation', async () => {
    const user = userEvent.setup();
    renderShell('/', { defaultLanguage: 'en' });
    const overview = screen.getByRole('button', { name: 'Overview' });
    const execute = screen.getByRole('button', { name: 'Execute' });

    await user.click(overview);
    expect(overview).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(execute).toHaveFocus();
    expect(execute).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(execute, { key: 'Escape' });
    expect(execute).toHaveAttribute('aria-expanded', 'false');

    await user.click(execute);
    await user.click(screen.getByRole('main'));
    expect(execute).toHaveAttribute('aria-expanded', 'false');
  });

  test('provides an accessible mobile drawer with navigation and environment selection', async () => {
    const user = userEvent.setup();
    renderShell('/', { defaultLanguage: 'en' });

    await user.click(screen.getByRole('button', { name: /open navigation/i }));

    const drawer = screen.getByRole('dialog', { name: /navigation/i });
    expect(drawer).toBeInTheDocument();
    const closeButton = within(drawer).getByRole('button', { name: /close navigation/i });
    expect(closeButton).toHaveFocus();
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');
    expect(within(drawer).getByRole('link', { name: 'Tasks' })).toHaveAttribute('href', '/tasks');
    expect(within(drawer).getByRole('link', { name: 'Run Details' })).toHaveAttribute('href', '/observation');
    expect(within(drawer).getByLabelText(/mobile environment/i)).toHaveValue('java-sut');
    expect(within(drawer).queryByText('TestWise')).not.toBeInTheDocument();
    const lastLink = within(drawer).getByRole('link', { name: 'Settings' });
    lastLink.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open navigation/i })).toHaveFocus();
  });

  test('SUT selector refreshes task creation context', async () => {
    const user = userEvent.setup();
    renderShell('/tasks');

    await user.click(screen.getByRole('tab', { name: /新建任务|new task/i }));
    await user.selectOptions(screen.getByLabelText('environment'), 'python-sut');

    const summary = screen.getByTestId('task-context-summary');
    expect(within(summary).getByText(/高码python/i)).toBeInTheDocument();
    expect(within(summary).getByText(/API/i)).toBeInTheDocument();
  });

  test('keeps the observation URL while visibly naming it Run Details', () => {
    renderShell('/observation');

    expect(screen.getByRole('heading', { name: /运行详情/i })).toBeInTheDocument();
    expect(screen.getByText(/pytest testcase\/save/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /实时日志/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /导出日志/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
