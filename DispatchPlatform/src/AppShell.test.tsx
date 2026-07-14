import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppShell } from './AppShell';
import { resolveRuntimeConfig } from './config/runtime';

const expectedNavigation = [
  ['Overview', '/'],
  ['Tasks', '/tasks'],
  ['Observe', '/observation'],
  ['Results', '/results'],
  ['Scripts', '/scripts'],
  ['Knowledge', '/knowledge'],
  ['Settings', '/settings']
] as const;

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
  test('renders the exact Console brand and direct primary navigation', () => {
    renderShell('/', { defaultLanguage: 'zh' });

    expect(screen.getAllByText('Console')).toHaveLength(1);
    expect(screen.getByRole('banner')).toHaveClass('app-header');
    expect(screen.getByRole('img', { name: 'Fairy spark' })).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getAllByRole('link').map((link) => [
      link.textContent,
      link.getAttribute('href')
    ])).toEqual(expectedNavigation);
    expect(within(navigation).getAllByRole('link').filter(
      (link) => link.getAttribute('aria-current') === 'page'
    )).toHaveLength(1);

    const objectControl = screen.getByTestId('object-control');
    expect(objectControl).toHaveTextContent('Object');
    expect(objectControl).toHaveTextContent('营销系统 Java SUT');
    expect(objectControl).toHaveTextContent('v2.4.1');
    expect(objectControl).toHaveTextContent('健康');
    expect(screen.getByLabelText('Object')).toHaveAccessibleDescription(/健康/);
    expect(screen.getByRole('button', { name: /english/i })).toHaveTextContent(/^EN$/);
    expect(screen.getByRole('button', { name: /登录|sign in/i })).toHaveTextContent(/^TW$/);

    for (const removedText of [
      'TestWise',
      'Test Agent Console',
      '测试指挥控制台',
      'TESTWISE CONTROL PLANE',
      'Health'
    ]) {
      expect(screen.queryByText(removedText)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /notifications|通知/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overview|execute|analysis|assets|system/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  test('renders the approved Overview hierarchy inside the shared shell', () => {
    renderShell();

    expect(screen.getByRole('heading', { name: /测试看板/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /当前执行/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /质量摘要/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /执行路径/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /最近活动/i })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /需要关注/i })).toBeInTheDocument();
    expect(screen.queryByText(/执行焦点/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/L0 质量摘要/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/五分类责任分流/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/基本功能质量矩阵/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DFX 维度雷达/i)).not.toBeInTheDocument();
  });

  test('keeps the direct navigation active state aligned with the current route', () => {
    renderShell('/observation', { defaultLanguage: 'en' });

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getByRole('link', { name: 'Observe' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(navigation).getAllByRole('link').filter(
      (link) => link.getAttribute('aria-current') === 'page'
    )).toHaveLength(1);
  });

  test('switches the product shell between Chinese and English without translating navigation', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /english/i }));

    expect(document.documentElement).toHaveClass('lang-en');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(
      expectedNavigation.map(([label]) => label)
    );
  });

  test('provides the same seven links and required controls in the accessible drawer', async () => {
    const user = userEvent.setup();
    renderShell('/', { defaultLanguage: 'zh' });

    const openButton = screen.getByRole('button', { name: /打开导航|open navigation/i });
    await user.click(openButton);

    const drawer = screen.getByRole('dialog', { name: /导航|navigation/i });
    const closeButton = within(drawer).getByRole('button', { name: /关闭导航|close navigation/i });
    expect(closeButton).toHaveFocus();
    expect(screen.getByRole('banner', { hidden: true })).toHaveAttribute('inert');
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');

    const navigation = within(drawer).getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getAllByRole('link').map((link) => [
      link.textContent,
      link.getAttribute('href')
    ])).toEqual(expectedNavigation);
    const objectControl = within(drawer).getByTestId('drawer-object-control');
    expect(within(objectControl).getByLabelText('Object')).toHaveValue('java-sut');
    expect(objectControl).toHaveTextContent('营销系统 Java SUT');
    expect(objectControl).toHaveTextContent('v2.4.1');
    expect(objectControl).toHaveTextContent('健康');
    expect(within(drawer).getByRole('button', { name: /english/i })).toHaveTextContent(/^EN$/);
    const accountButton = within(drawer).getByRole('button', { name: /登录|sign in/i });
    expect(accountButton).toHaveTextContent(/^TW$/);

    accountButton.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /导航|navigation/i })).not.toBeInTheDocument();
    expect(openButton).toHaveFocus();
  });

  test('closes the drawer account menu when another drawer control is pressed', async () => {
    const user = userEvent.setup();
    renderShell('/', { defaultLanguage: 'zh' });

    await user.click(screen.getByRole('button', { name: /打开导航|open navigation/i }));
    const drawer = screen.getByRole('dialog', { name: /导航|navigation/i });
    await user.click(within(drawer).getByRole('button', { name: /登录|sign in/i }));
    expect(within(drawer).getByRole('menu')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: /english/i }));

    expect(within(drawer).queryByRole('menu')).not.toBeInTheDocument();
    expect(drawer).toBeInTheDocument();
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');
  });

  test('closes the drawer after navigation and restores the shell', async () => {
    const user = userEvent.setup();
    renderShell('/', { defaultLanguage: 'en' });

    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    const drawer = screen.getByRole('dialog', { name: /navigation/i });
    await user.click(within(drawer).getByRole('link', { name: 'Tasks' }));

    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page');
  });

  test('Object selection refreshes task creation context', async () => {
    const user = userEvent.setup();
    renderShell('/tasks');

    await user.click(screen.getByRole('tab', { name: /新建任务|new task/i }));
    await user.selectOptions(screen.getByLabelText('Object'), 'python-sut');

    const summary = screen.getByTestId('task-context-summary');
    expect(within(summary).getByText(/高码python/i)).toBeInTheDocument();
    expect(within(summary).getByText(/API/i)).toBeInTheDocument();
  });

  test('keeps the observation route and existing task behavior unchanged', () => {
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
