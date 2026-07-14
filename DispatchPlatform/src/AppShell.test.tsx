import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppShell } from './AppShell';
import { resolveRuntimeConfig } from './config/runtime';
import { activeTask as mockActiveTask } from './data/mockData';

const englishNavigation = [
  ['Overview', '/'],
  ['Tasks', '/tasks'],
  ['Observe', '/observation'],
  ['Results', '/results'],
  ['Scripts', '/scripts'],
  ['Knowledge', '/knowledge'],
  ['Settings', '/settings']
] as const;

const chineseNavigation = [
  ['总览', '/'],
  ['任务', '/tasks'],
  ['观测', '/observation'],
  ['结果', '/results'],
  ['脚本', '/scripts'],
  ['知识', '/knowledge'],
  ['设置', '/settings']
] as const;

const navigationDestinations = [
  ['总览', '/', '测试看板'],
  ['任务', '/tasks', '任务调度'],
  ['观测', '/observation', '执行观测'],
  ['结果', '/results', '结果与报告'],
  ['脚本', '/scripts', '脚本资产'],
  ['知识', '/knowledge', '知识库'],
  ['设置', '/settings', '设置']
] as const;

const shellStyles = readFileSync('src/styles/shell.css', 'utf8');

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

function renderNavigationShell(initialPath = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <QueryClientProvider client={client}>
          <AppShell runtimeConfig={resolveRuntimeConfig({ defaultLanguage: 'zh' })} />
        </QueryClientProvider>
      )
    }
  ], { initialEntries: [initialPath] });

  return {
    router,
    ...render(<RouterProvider router={router} />)
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  test('renders the exact Console brand and direct primary navigation', () => {
    renderShell('/', { defaultLanguage: 'zh' });

    expect(screen.getAllByText('Console')).toHaveLength(1);
    expect(screen.getByRole('banner')).toHaveClass('app-header');
    expect(screen.getByRole('img', { name: 'TestWise ghost' })).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getAllByRole('link').map((link) => [
      link.textContent,
      link.getAttribute('href')
    ])).toEqual(chineseNavigation);
    expect(within(navigation).getAllByRole('link').filter(
      (link) => link.getAttribute('aria-current') === 'page'
    )).toHaveLength(1);

    const objectControl = screen.getByTestId('object-control');
    expect(objectControl).toHaveTextContent('Object');
    expect(objectControl).toHaveTextContent('高码java 场景');
    expect(objectControl).not.toHaveTextContent('营销系统 Java SUT');
    expect(objectControl).not.toHaveTextContent('v2.4.1');
    expect(objectControl).not.toHaveTextContent('健康');
    expect(screen.getByLabelText('Object')).not.toHaveAttribute('aria-describedby');
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

  test('encodes the approved 72px centered desktop header contract', () => {
    expect(shellStyles).toMatch(/\.app-header\s*\{[^}]*height:\s*72px;[^}]*background:\s*#fff;/s);
    expect(shellStyles).toMatch(/\.app-header__inner\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+496px\s+minmax\(0,\s*1fr\);[^}]*max-width:\s*1440px;[^}]*height:\s*72px;[^}]*padding:\s*0 40px;/s);
    expect(shellStyles).toMatch(/\.desktop-navigation\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(7,\s*64px\);[^}]*gap:\s*8px;/s);
    expect(shellStyles).toMatch(/\.desktop-nav-link\s*\{[^}]*width:\s*64px;[^}]*height:\s*40px;[^}]*border-radius:\s*16px;[^}]*font-size:\s*15px;/s);
    expect(shellStyles).toMatch(/\.gradient-ghost-logo\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
    expect(shellStyles).toMatch(/\.desktop-object-control\s*\{[^}]*width:\s*216px;/s);
    expect(shellStyles).toMatch(/\.object-control\s*\{[^}]*height:\s*44px;[^}]*border-radius:\s*16px;/s);
    expect(shellStyles).toMatch(/\.language-button,[\s\S]*?\.account-menu__trigger\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
    expect(shellStyles).toMatch(/\.language-button,[\s\S]*?\.account-menu__trigger\s*\{[^}]*font-weight:\s*500;/s);
    expect(shellStyles).toMatch(/\.account-menu__trigger\s*\{[^}]*font-weight:\s*700;/s);
    expect(shellStyles).toMatch(/@media \(max-width:\s*1319px\)\s*\{[\s\S]*?\.app-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*\}[\s\S]*?\.app-header__actions\s*\{[^}]*grid-column:\s*2;[^}]*\}/s);
  });

  test('clicks through every direct destination without exposing legacy or extra UI', async () => {
    const user = userEvent.setup();
    const { router, container } = renderNavigationShell();

    for (const [label, path, heading] of navigationDestinations) {
      const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
      const destination = within(navigation).getByRole('link', { name: label });
      await user.click(destination);

      expect(router.state.location.pathname).toBe(path);
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();

      const links = within(navigation).getAllByRole('link');
      expect(links).toHaveLength(7);
      expect(links.filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(1);
      expect(links.filter((link) => !link.hasAttribute('aria-current'))).toHaveLength(6);
      expect(destination).toHaveAttribute('aria-current', 'page');

      for (const removedText of [
        'TestWise',
        'Test Agent Console',
        '测试指挥控制台',
        'TESTWISE CONTROL PLANE',
        'Health'
      ]) {
        expect(screen.queryByText(removedText, { exact: true })).not.toBeInTheDocument();
      }
      expect(container.querySelector('svg.lucide-bell')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {
        name: /^(Overview|Execute|Analysis|Assets|System)$/i
      })).not.toBeInTheDocument();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

      if (label === '总览') {
        for (const extraText of [
          '执行焦点',
          'L0 质量摘要',
          '五分类责任分流',
          '基本功能质量矩阵',
          'DFX 维度雷达'
        ]) {
          expect(screen.queryByText(extraText, { exact: true })).not.toBeInTheDocument();
        }
      }
      if (label === '任务') {
        expect(screen.queryByText(/任务队列|本次会话/)).not.toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /上一步|下一步/ })).not.toBeInTheDocument();
      }
      if (label === '观测') {
        expect(screen.queryByRole('button', {
          name: /暂停|继续|清空|全部日志级别|警告|错误/
        })).not.toBeInTheDocument();
        expect(screen.queryByText(/实时连接|正在连接|日志已完成/)).not.toBeInTheDocument();
      }
      if (label === '结果') {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      }
      if (label === '脚本') {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
      }
      if (label === '知识') {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(container.querySelector('form')).not.toBeInTheDocument();
        expect(container.querySelector('footer')).not.toBeInTheDocument();
        expect(container.querySelector('[contenteditable="true"]')).not.toBeInTheDocument();
        expect(container.querySelector('[aria-label*="pagination" i]')).not.toBeInTheDocument();
      }
      if (label === '设置') {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(container.querySelector('form')).not.toBeInTheDocument();
        expect(container.querySelector('footer')).not.toBeInTheDocument();
      }

      if (path !== '/') {
        await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
      }
    }
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

  test('does not seed a mock active task when live mode has no session task', () => {
    renderShell('/', { enableMockFallback: false });

    const currentRun = screen.getByRole('region', { name: /当前执行/i });
    expect(within(currentRun).queryByText(mockActiveTask.task_id)).not.toBeInTheDocument();
    expect(within(currentRun).queryByText(/pytest testcase\/save/i)).not.toBeInTheDocument();
    expect(within(currentRun).getByText('暂无活动任务')).toBeInTheDocument();
    expect(within(currentRun).getByText('0 / 0')).toBeInTheDocument();
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

  test('switches the product shell and navigation between Chinese and English', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /english/i }));

    expect(document.documentElement).toHaveClass('lang-en');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(
      englishNavigation.map(([label]) => label)
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
    ])).toEqual(chineseNavigation);
    const objectControl = within(drawer).getByTestId('drawer-object-control');
    expect(within(objectControl).getByLabelText('Object')).toHaveValue('java-sut');
    expect(objectControl).toHaveTextContent('高码java 场景');
    expect(objectControl).not.toHaveTextContent('营销系统 Java SUT');
    expect(objectControl).not.toHaveTextContent('v2.4.1');
    expect(objectControl).not.toHaveTextContent('健康');
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

    await user.selectOptions(screen.getByLabelText('Object'), 'python-sut');

    const summary = screen.getByTestId('task-context-summary');
    expect(within(summary).getByText(/高码python/i)).toBeInTheDocument();
    expect(within(summary).getByText(/API/i)).toBeInTheDocument();
  });

  test('shares AppShell-owned Object and language state with Settings without persistence', async () => {
    const user = userEvent.setup();
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderShell('/settings', {
      apiBaseUrl: '/runtime-api',
      deploymentMode: 'container',
      defaultLanguage: 'zh',
      sutTargets: [
        {
          id: 'object-one',
          name: '对象一',
          product: '产品一',
          scene: 'API',
          version: 'v1',
          apiBaseUrl: '/object-one-api',
          status: 'healthy'
        },
        {
          id: 'object-two',
          name: '对象二',
          product: '产品二',
          scene: '场景',
          version: 'v2',
          apiBaseUrl: '/object-two-api',
          status: 'degraded'
        }
      ]
    });

    const settingsObject = screen.getByRole('combobox', { name: '默认 Object' });
    const headerObject = within(screen.getByTestId('object-control')).getByLabelText('Object');
    expect(settingsObject).toHaveValue('object-one');
    expect(headerObject).toHaveValue('object-one');

    await user.selectOptions(settingsObject, 'object-two');
    expect(headerObject).toHaveValue('object-two');
    expect(settingsObject).toHaveValue('object-two');
    expect(screen.getByRole('textbox', { name: 'API base URL' })).toHaveValue('/object-two-api');
    expect(within(screen.getByRole('region', { name: 'Object 连接' })).getByText('关注'))
      .toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'en');
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to chinese/i })).toHaveTextContent('中');
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
    expect(storageSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('the Tasks change-Object affordance focuses the desktop Object selector', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '(max-width: 1319px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    renderShell('/tasks');

    await user.click(screen.getByRole('button', { name: '更换对象' }));

    expect(within(screen.getByTestId('object-control')).getByLabelText('Object')).toHaveFocus();
  });

  test('the Tasks change-Object affordance opens the drawer and focuses its Object selector below 1320px', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      media: '(max-width: 1319px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    renderShell('/tasks');

    await user.click(screen.getByRole('button', { name: '更换对象' }));

    const drawer = await screen.findByRole('dialog', { name: /导航|navigation/i });
    expect(within(drawer).getByLabelText('Object')).toHaveFocus();
  });

  test('renders the approved Observe hierarchy while preserving its active-task behavior', () => {
    renderShell('/observation');

    expect(screen.getByRole('heading', { name: /执行观测/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /观测指标/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /执行路径/i })).toBeInTheDocument();
    expect(screen.getAllByText(/pytest testcase\/save/i)).toHaveLength(2);
    expect(screen.getByRole('heading', { name: /Execution events/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /任务控制/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /导出日志/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.queryByRole('button', { name: /暂停|继续|清空|全部日志级别/i })).not.toBeInTheDocument();
  });

  test('keeps live mode free of a fabricated active task on the Observe route', () => {
    renderShell('/observation', { enableMockFallback: false });

    expect(screen.getByRole('heading', { name: /任务调度/i })).toBeInTheDocument();
    expect(screen.queryByText(mockActiveTask.task_id)).not.toBeInTheDocument();
    expect(screen.queryByText(/Environment validation passed/i)).not.toBeInTheDocument();
  });

  test('passes newly created session task state through to Results without requesting reports', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/features')) {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          product: '高码java',
          scene: '场景',
          features: [{ id: 'shell-feature', name: 'Shell feature', type: 'L0' }],
          total: 1
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.pathname.endsWith('/scripts')) {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          scripts: [{
            id: 'shell-script',
            name: 'shell_script',
            filename: 'shell_script.py',
            extension: '.py',
            product: '高码java',
            scene: '场景',
            feature: 'Shell feature',
            level: 'L0',
            size: 100,
            uploaded_at: '2026-07-14T10:00:00',
            uploaded_by: 'shell-user',
            path: 'testcase/shell_script.py'
          }],
          total: 1,
          filters: {}
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.pathname.endsWith('/tasks') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          task_id: 'task_from_app_shell',
          status: 'queued',
          message: 'Task queued',
          queue_position: 1,
          total_scripts: 1,
          created_at: '2026-07-14T10:42:00',
          estimated_duration: '1 minute'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.pathname.endsWith('/tasks/task_from_app_shell/logs')) {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          total: 0,
          logs: []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.pathname.endsWith('/tasks/task_from_app_shell')) {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          task: {
            id: 'task_from_app_shell',
            status: 'queued',
            progress: 0,
            total_scripts: 1,
            executed_scripts: 0,
            failed_scripts: 0,
            queue_position: 1,
            started_at: '2026-07-14T10:42:00'
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });
    renderShell('/tasks', { enableMockFallback: false });

    await waitFor(() => expect(screen.getByLabelText('Feature')).toHaveValue('Shell feature'));
    await waitFor(() => expect(screen.getByRole('button', { name: '启动执行' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '启动执行' }));
    expect(await screen.findByRole('heading', { name: '执行观测' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '结果' }));

    const reports = await screen.findByRole('region', { name: '最近报告' });
    expect(within(reports).getByText('task_from_app_shell')).toBeInTheDocument();
    expect(within(reports).getAllByRole('row')).toHaveLength(2);
    expect(fetchSpy.mock.calls.filter(([input]) => (
      new URL(String(input), 'http://local.test').pathname.includes('/reports')
    ))).toHaveLength(0);
  });
});
