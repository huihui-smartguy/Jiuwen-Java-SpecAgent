import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import { mockScripts } from '../data/mockData';
import type { RuntimeConfig, Script, SutTarget } from '../types';
import { Scripts } from './Scripts';

const mockRuntimeConfig = resolveRuntimeConfig({
  defaultLanguage: 'zh',
  enableMockFallback: true
});

const expectedMockRows = [
  ['test_ak006_list_api_keys', 'api/keys/list.py', 'API 密钥管理', 'L1', '通过', 'huihui', '今天 10:36'],
  ['test_ak007_create_key', 'api/keys/create.py', 'API 密钥管理', 'L1', '通过', 'huihui', '今天 10:31'],
  ['test_auth021_role_scope', 'auth/role/scope.py', '用户权限', 'L2', '失败', 'liuming', '昨天 16:22'],
  ['test_session013_expire', 'session/expire.py', '会话管理', 'L1', '通过', 'wangqi', '7 月 12 日']
] as const;

const approvedMockScriptIds = new Set([
  'script-ak006',
  'script-ak007',
  'script-auth021',
  'script-session013'
]);

function LocationProbe() {
  return <span data-testid="location-path">{useLocation().pathname}</span>;
}

function renderScripts({
  runtimeConfig = mockRuntimeConfig,
  selectedSut = runtimeConfig.sutTargets[0]
}: {
  runtimeConfig?: RuntimeConfig;
  selectedSut?: SutTarget;
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const renderTree = (sut: SutTarget) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/scripts']}>
        <Scripts
          language="zh"
          selectedSut={sut}
          runtimeConfig={runtimeConfig}
        />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(renderTree(selectedSut));

  return {
    ...view,
    rerenderSelectedSut: (sut: SutTarget) => view.rerender(renderTree(sut))
  };
}

function json(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  } as Response);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

interface FeatureScope {
  name: string;
  scripts: Script[];
}

function mockFeatureScopedScriptsApi(scopes: FeatureScope[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input), 'http://local.test');
    if (url.pathname.endsWith('/features')) {
      return json({
        success: true,
        product: url.searchParams.get('product'),
        scene: url.searchParams.get('scene'),
        features: scopes.map((scope, index) => ({
          id: `feature-${index + 1}`,
          name: scope.name,
          type: 'L1'
        })),
        total: scopes.length
      });
    }
    if (url.pathname.endsWith('/scripts')) {
      const feature = url.searchParams.get('feature');
      const scope = scopes.find((candidate) => candidate.name === feature);
      if (!feature || !scope) {
        throw new Error(`expected an exact feature request: ${url.toString()}`);
      }

      return json({
        success: true,
        scripts: scope.scripts,
        total: scope.scripts.length,
        filters: {
          product: url.searchParams.get('product'),
          scene: url.searchParams.get('scene'),
          feature,
          level: url.searchParams.get('level')
        }
      });
    }

    throw new Error(`unexpected request: ${url.toString()}`);
  });
}

function mockLiveScriptsApi(scripts: Script[]) {
  const featureNames = Array.from(new Set(scripts.map((script) => script.feature)));
  return mockFeatureScopedScriptsApi(featureNames.map((name) => ({
    name,
    scripts: scripts.filter((script) => script.feature === name)
  })));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('approved Scripts frame', () => {
  test('keeps the approved four-row fallback frame without mutating the shared API-shaped fixtures', () => {
    const selectedSut = mockRuntimeConfig.sutTargets[0];

    expect(mockScripts).toHaveLength(5);
    expect(expectedMockRows).toHaveLength(4);
    expect(mockScripts.filter((script) => approvedMockScriptIds.has(script.id)).map((script) => [
      script.name,
      script.path,
      script.feature,
      script.level,
      script.uploaded_by
    ])).toEqual(expectedMockRows.map(([name, path, feature, level, , owner]) => (
      [name, path, feature, level, owner]
    )));

    for (const script of mockScripts) {
      expect(script).toMatchObject({
        extension: '.py',
        product: selectedSut.product,
        scene: selectedSut.scene
      });
      expect(script.id).not.toBe('');
      expect(script.filename.endsWith('.py')).toBe(true);
      expect(script.size).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(script.uploaded_at ?? ''))).toBe(false);
    }
  });

  test('renders the exact approved mock summaries, controls, columns, rows, and result order', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    renderScripts();

    expect(screen.getByRole('heading', { level: 1, name: '脚本资产' })).toBeInTheDocument();
    expect(screen.getByText('按对象、Feature 与级别管理可执行脚本，保持范围清晰且可追溯。')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: '脚本概览' });
    await waitFor(() => expect(
      within(summary).getAllByTestId('script-summary-value').map((value) => value.textContent)
    ).toEqual(['286', '84', '126', '76']));
    expect(within(summary).getAllByRole('article')).toHaveLength(4);
    expect(summary.querySelector('.scripts-summary-icon')).not.toBeInTheDocument();

    const filters = screen.getByRole('region', { name: '脚本筛选' });
    expect(filters.querySelectorAll('input, select, button')).toHaveLength(4);
    expect(within(filters).getByRole('searchbox', { name: '搜索脚本' })).toHaveAttribute(
      'placeholder',
      '搜索脚本、路径或标签'
    );
    expect(within(filters).getByRole('textbox', { name: 'Object' })).toHaveAttribute('readonly');
    expect(within(filters).getByRole('textbox', { name: 'Object' })).toHaveValue(
      'Object · High-Code Java scene'
    );
    expect(within(filters).getByRole('combobox', { name: 'Level' })).toHaveValue('All');
    expect(within(filters).getByRole('combobox', { name: 'Feature' })).toHaveValue('All');
    expect(within(filters).getByRole('option', { name: '全部级别' })).toBeInTheDocument();
    expect(within(filters).getByRole('option', { name: '全部 Feature' })).toBeInTheDocument();
    expect(within(filters).queryByRole('button')).not.toBeInTheDocument();
    expect(
      within(filters).getByRole('searchbox', { name: '搜索脚本' }).closest('label')?.querySelector('svg')
    ).not.toBeInTheDocument();

    const table = await screen.findByRole('table', { name: '脚本资产' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '脚本',
      'Feature',
      '级别',
      '最近结果',
      '负责人',
      '更新时间'
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual(
      expectedMockRows.map(([name, path, feature, level, result, owner, updated]) => [
        `${name}${path}`,
        feature,
        level,
        result,
        owner,
        updated
      ])
    );
    expect(rows.map((row) => within(row).getAllByRole('cell')[3].textContent)).toEqual([
      '通过',
      '通过',
      '失败',
      '通过'
    ]);
    expect(table.querySelector('.scripts-level-pill')).not.toBeInTheDocument();
    expect(table.querySelectorAll('.scripts-status-pill > span')).toHaveLength(0);
  });

  test('keeps pending summaries unknown and announces loading inside the busy table card', async () => {
    const pendingResponse = deferred<Response>();
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingResponse.promise);
    renderScripts();

    const summary = screen.getByRole('region', { name: '脚本概览' });
    expect(within(summary).getAllByTestId('script-summary-value').map((value) => value.textContent)).toEqual([
      '—',
      '—',
      '—',
      '—'
    ]);

    const tableCard = screen.getByRole('region', { name: '脚本资产' });
    const table = within(tableCard).getByRole('table', { name: '脚本资产' });
    expect(tableCard).toHaveAttribute('aria-busy', 'true');
    expect(within(table).getByRole('status')).toHaveTextContent('正在加载脚本');
    expect(within(table).queryByText('没有匹配的脚本')).not.toBeInTheDocument();

    pendingResponse.resolve(await json({
      success: true,
      product: mockRuntimeConfig.sutTargets[0].product,
      scene: mockRuntimeConfig.sutTargets[0].scene,
      features: [],
      total: 0,
    }));
    await waitFor(() => expect(tableCard).not.toHaveAttribute('aria-busy', 'true'));
  });

  test('keeps fallback-disabled errors unknown and announces unavailability inside the table', async () => {
    const runtimeConfig = resolveRuntimeConfig({
      defaultLanguage: 'zh',
      enableMockFallback: false
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    renderScripts({ runtimeConfig, selectedSut: runtimeConfig.sutTargets[0] });

    const summary = screen.getByRole('region', { name: '脚本概览' });
    const tableCard = screen.getByRole('region', { name: '脚本资产' });
    const table = within(tableCard).getByRole('table', { name: '脚本资产' });
    expect(await within(table).findByRole('alert')).toHaveTextContent('脚本暂不可用');
    expect(within(summary).getAllByTestId('script-summary-value').map((value) => value.textContent)).toEqual([
      '—',
      '—',
      '—',
      '—'
    ]);
    expect(tableCard).not.toHaveAttribute('aria-busy', 'true');
    expect(within(table).queryByText('没有匹配的脚本')).not.toBeInTheDocument();
  });

  test('keeps the import affordance focusable and inert without upload, feedback, or navigation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const user = userEvent.setup();
    renderScripts();

    const importButton = screen.getByRole('button', { name: /导入脚本/ });
    expect(importButton).toHaveAttribute('aria-disabled', 'true');
    expect(importButton).not.toBeDisabled();
    importButton.focus();
    expect(importButton).toHaveFocus();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const requestCount = fetchSpy.mock.calls.length;

    await user.click(importButton);
    await user.keyboard('{Enter}');

    expect(fetchSpy).toHaveBeenCalledTimes(requestCount);
    expect(screen.getByTestId('location-path')).toHaveTextContent('/scripts');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toEqual([importButton]);
  });

  test('uses the selected Object API base and target for feature discovery and one exact feature request', async () => {
    const runtimeConfig = resolveRuntimeConfig({
      defaultLanguage: 'zh',
      enableMockFallback: false,
      apiBaseUrl: '/runtime-api',
      sutTargets: [{
        id: 'live-object',
        name: '合一版本 API · Live',
        product: '合一版本',
        scene: 'API',
        version: 'v-live',
        apiBaseUrl: '/object-api',
        status: 'healthy'
      }]
    });
    const liveScript: Script = {
      id: 'live-one',
      name: 'live_script',
      filename: 'live_script.py',
      extension: '.py',
      product: '合一版本',
      scene: 'API',
      feature: 'Live feature',
      level: 'L1',
      size: 64,
      uploaded_at: '2026-07-14T09:00:00+08:00',
      uploaded_by: 'live-owner',
      path: 'api/live_script.py'
    };
    const fetchSpy = mockLiveScriptsApi([liveScript]);

    renderScripts({ runtimeConfig, selectedSut: runtimeConfig.sutTargets[0] });

    expect(await screen.findByText('live_script')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const requests = fetchSpy.mock.calls.map(([input]) => new URL(String(input), 'http://local.test'));
    expect(requests.map((request) => request.pathname)).toEqual([
      '/object-api/features',
      '/object-api/scripts'
    ]);
    for (const request of requests) {
      expect(request.searchParams.get('product')).toBe('合一版本');
      expect(request.searchParams.get('scene')).toBe('API');
    }
    expect(requests[0].searchParams.has('feature')).toBe(false);
    expect(requests[1].searchParams.get('feature')).toBe('Live feature');
    expect(requests[1].searchParams.has('level')).toBe(false);
  });

  test('aggregates every discovered feature in order and stably deduplicates repeated scripts', async () => {
    const baseScript: Script = {
      id: 'shared-script',
      name: 'shared_from_first_feature',
      filename: 'shared.py',
      extension: '.py',
      product: '合一版本',
      scene: 'API',
      feature: 'Feature A',
      level: 'L1',
      size: 64,
      path: 'api/shared.py'
    };
    const fetchSpy = mockFeatureScopedScriptsApi([
      {
        name: 'Feature A',
        scripts: [
          baseScript,
          { ...baseScript, id: 'feature-a-only', name: 'feature_a_only', path: 'api/a.py' }
        ]
      },
      {
        name: 'Feature B',
        scripts: [
          { ...baseScript, name: 'duplicate_from_second_feature', feature: 'Feature B' },
          { ...baseScript, id: 'feature-b-only', name: 'feature_b_only', feature: 'Feature B', path: 'api/b.py' }
        ]
      }
    ]);

    renderScripts();

    const table = await screen.findByRole('table', { name: '脚本资产' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4));
    const names = within(table).getAllByRole('row').slice(1).map((row) => (
      within(row).getAllByRole('cell')[0].textContent
    ));
    expect(names).toEqual([
      'shared_from_first_featureapi/shared.py',
      'feature_a_onlyapi/a.py',
      'feature_b_onlyapi/b.py'
    ]);
    expect(within(table).queryByText('duplicate_from_second_feature')).not.toBeInTheDocument();
    expect(fetchSpy.mock.calls.map(([input]) => {
      const url = new URL(String(input), 'http://local.test');
      return [url.pathname, url.searchParams.get('feature')];
    })).toEqual([
      ['/api/features', null],
      ['/api/scripts', 'Feature A'],
      ['/api/scripts', 'Feature B']
    ]);
  });

  test('shows the empty state without issuing an unfiltered scripts request when no features exist', async () => {
    const fetchSpy = mockFeatureScopedScriptsApi([]);

    renderScripts();

    const table = await screen.findByRole('table', { name: '脚本资产' });
    expect(await within(table).findByText('没有匹配的脚本')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = new URL(String(fetchSpy.mock.calls[0][0]), 'http://local.test');
    expect(request.pathname).toBe('/api/features');
    expect(request.searchParams.get('product')).toBe(mockRuntimeConfig.sutTargets[0].product);
    expect(request.searchParams.get('scene')).toBe(mockRuntimeConfig.sutTargets[0].scene);
  });

  test('never caps live API rows to the four-row approved fallback frame', async () => {
    const liveRows = mockScripts.map((script, index): Script => ({
      ...script,
      id: `live-${index + 1}`,
      name: `live_script_${index + 1}`,
      filename: `live_script_${index + 1}.py`
    }));
    mockLiveScriptsApi(liveRows);

    renderScripts();

    const table = await screen.findByRole('table', { name: '脚本资产' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(6));
    for (const liveRow of liveRows) {
      expect(within(table).getByText(liveRow.name)).toBeInTheDocument();
    }
  });

  test('keeps fallback rows target-scoped instead of leaking them to another Object', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const otherObject = mockRuntimeConfig.sutTargets[1];

    renderScripts({ selectedSut: otherObject });

    const table = await screen.findByRole('table', { name: '脚本资产' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2));
    expect(within(table).getByText('没有匹配的脚本')).toBeInTheDocument();
    for (const [scriptName] of expectedMockRows) {
      expect(within(table).queryByText(scriptName)).not.toBeInTheDocument();
    }
  });

  test('filters fetched rows locally by search, Level, and Feature with a stable request count', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const user = userEvent.setup();
    renderScripts();

    const table = await screen.findByRole('table', { name: '脚本资产' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(5));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Feature' }), 'API 密钥管理');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Level' }), 'L1');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await user.type(screen.getByRole('searchbox', { name: '搜索脚本' }), 'create');

    const filteredRows = within(table).getAllByRole('row');
    expect(filteredRows).toHaveLength(2);
    expect(within(table).getByText('test_ak007_create_key')).toBeInTheDocument();
    expect(within(table).queryByText('test_ak006_list_api_keys')).not.toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('refetches and resets target filters when Object ID and API base change within one scope', async () => {
    const runtimeConfig = resolveRuntimeConfig({
      defaultLanguage: 'zh',
      enableMockFallback: false,
      sutTargets: [
        {
          id: 'alpha-object',
          name: 'Alpha Object',
          product: 'SharedProduct',
          scene: 'SharedScene',
          version: 'v1',
          apiBaseUrl: '/alpha-api',
          status: 'healthy'
        },
        {
          id: 'beta-object',
          name: 'Beta Object',
          product: 'SharedProduct',
          scene: 'SharedScene',
          version: 'v2',
          apiBaseUrl: '/beta-api',
          status: 'healthy'
        }
      ]
    });
    const rowsByPath: Record<string, Script[]> = {
      '/alpha-api/scripts': [{
        id: 'alpha-script',
        name: 'alpha_script',
        filename: 'alpha_script.py',
        extension: '.py',
        product: 'SharedProduct',
        scene: 'SharedScene',
        feature: 'Alpha Feature',
        level: 'L1',
        size: 10,
        uploaded_by: 'alpha-owner',
        path: 'alpha/alpha_script.py'
      }],
      '/beta-api/scripts': [{
        id: 'beta-script',
        name: 'beta_script',
        filename: 'beta_script.py',
        extension: '.py',
        product: 'SharedProduct',
        scene: 'SharedScene',
        feature: 'Beta Feature',
        level: 'L3',
        size: 20,
        uploaded_by: 'beta-owner',
        path: 'beta/beta_script.py'
      }]
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/features')) {
        const scripts = rowsByPath[url.pathname.replace(/\/features$/, '/scripts')] ?? [];
        return json({
          success: true,
          product: url.searchParams.get('product'),
          scene: url.searchParams.get('scene'),
          features: scripts.map((script) => ({ id: script.feature, name: script.feature, type: script.level })),
          total: scripts.length
        });
      }
      const scripts = rowsByPath[url.pathname] ?? [];
      expect(url.searchParams.get('feature')).toBe(scripts[0]?.feature);
      return json({ success: true, scripts, total: scripts.length, filters: {} });
    });
    const user = userEvent.setup();
    const { rerenderSelectedSut } = renderScripts({
      runtimeConfig,
      selectedSut: runtimeConfig.sutTargets[0]
    });

    expect(await screen.findByText('alpha_script')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Level' }), 'L1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Feature' }), 'Alpha Feature');
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    rerenderSelectedSut(runtimeConfig.sutTargets[1]);

    expect(await screen.findByText('beta_script')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Level' })).toHaveValue('All');
    expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveValue('All');
    expect(fetchSpy).toHaveBeenCalledTimes(4);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Level' }), 'L3');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Feature' }), 'Beta Feature');
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy.mock.calls.map(([input]) => (
      new URL(String(input), 'http://local.test').pathname
    ))).toEqual([
      '/alpha-api/features',
      '/alpha-api/scripts',
      '/beta-api/features',
      '/beta-api/scripts'
    ]);
  });

  test('refetches and resets target filters when Object data changes under the same ID', async () => {
    const initialTarget: SutTarget = {
      id: 'mutable-object',
      name: 'Mutable Object v1',
      product: 'InitialProduct',
      scene: 'InitialScene',
      version: 'v1',
      apiBaseUrl: '/initial-api',
      status: 'healthy'
    };
    const updatedTarget: SutTarget = {
      id: 'mutable-object',
      name: 'Mutable Object v2',
      product: 'UpdatedProduct',
      scene: 'UpdatedScene',
      version: 'v2',
      apiBaseUrl: '/updated-api',
      status: 'healthy'
    };
    const runtimeConfig = resolveRuntimeConfig({
      defaultLanguage: 'zh',
      enableMockFallback: false,
      sutTargets: [initialTarget]
    });
    const rowsByPath: Record<string, Script[]> = {
      '/initial-api/scripts': [{
        id: 'initial-script',
        name: 'initial_script',
        filename: 'initial_script.py',
        extension: '.py',
        product: 'InitialProduct',
        scene: 'InitialScene',
        feature: 'Initial Feature',
        level: 'L1',
        size: 10,
        uploaded_by: 'initial-owner',
        path: 'initial/initial_script.py'
      }],
      '/updated-api/scripts': [{
        id: 'updated-script',
        name: 'updated_script',
        filename: 'updated_script.py',
        extension: '.py',
        product: 'UpdatedProduct',
        scene: 'UpdatedScene',
        feature: 'Updated Feature',
        level: 'L3',
        size: 20,
        uploaded_by: 'updated-owner',
        path: 'updated/updated_script.py'
      }]
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/features')) {
        const scripts = rowsByPath[url.pathname.replace(/\/features$/, '/scripts')] ?? [];
        return json({
          success: true,
          product: url.searchParams.get('product'),
          scene: url.searchParams.get('scene'),
          features: scripts.map((script) => ({ id: script.feature, name: script.feature, type: script.level })),
          total: scripts.length
        });
      }
      const scripts = rowsByPath[url.pathname] ?? [];
      expect(url.searchParams.get('feature')).toBe(scripts[0]?.feature);
      return json({ success: true, scripts, total: scripts.length, filters: {} });
    });
    const user = userEvent.setup();
    const { rerenderSelectedSut } = renderScripts({ runtimeConfig, selectedSut: initialTarget });

    expect(await screen.findByText('initial_script')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Level' }), 'L1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Feature' }), 'Initial Feature');
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    rerenderSelectedSut(updatedTarget);

    expect(await screen.findByText('updated_script')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Level' })).toHaveValue('All');
    expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveValue('All');
    expect(fetchSpy).toHaveBeenCalledTimes(4);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Level' }), 'L3');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Feature' }), 'Updated Feature');
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  test('derives live summaries only from fetched rows and never assigns mock Last result values', async () => {
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
    const liveRows: Script[] = [
      {
        id: 'live-l0',
        name: 'live_l0',
        filename: 'live_l0.py',
        extension: '.py',
        product: 'LiveProduct',
        scene: 'API',
        feature: 'Core API',
        level: 'L0',
        size: 10,
        uploaded_by: 'one',
        path: 'api/live_l0.py'
      },
      {
        id: 'live-auth',
        name: 'live_auth',
        filename: 'live_auth.py',
        extension: '.py',
        product: 'LiveProduct',
        scene: 'API',
        feature: 'Auth',
        level: 'L2',
        size: 20,
        uploaded_by: 'two',
        path: 'auth/live_auth.py'
      },
      {
        id: 'live-web',
        name: 'live_web',
        filename: 'live_web.py',
        extension: '.py',
        product: 'LiveProduct',
        scene: 'API',
        feature: '场景自动化',
        level: 'L3',
        size: 30,
        uploaded_by: 'three',
        path: 'web/live_web.py'
      }
    ];
    mockLiveScriptsApi(liveRows);

    renderScripts({ runtimeConfig, selectedSut: runtimeConfig.sutTargets[0] });

    const summary = screen.getByRole('region', { name: '脚本概览' });
    await waitFor(() => expect(
      within(summary).getAllByTestId('script-summary-value').map((value) => value.textContent)
    ).toEqual(['3', '1', '3', '1']));
    expect(summary).toHaveTextContent('1 个测试对象');
    expect(summary).toHaveTextContent('最近同步 —');
    expect(summary).toHaveTextContent('3 个 Feature');
    expect(summary).toHaveTextContent('1 个脚本');
    for (const mockOnlyValue of [
      '286',
      '84',
      '126',
      '76',
      '第 4 个测试对象',
      '最近同步 10:36',
      '9 个 Feature',
      '3 个端到端套件'
    ]) {
      expect(within(summary).queryByText(mockOnlyValue)).not.toBeInTheDocument();
    }

    const table = screen.getByRole('table', { name: '脚本资产' });
    const resultCells = within(table).getAllByRole('row').slice(1).map((row) => (
      within(row).getAllByRole('cell')[3].textContent
    ));
    expect(resultCells).toEqual(['—', '—', '—']);
    expect(within(table).queryByText(/Passed|Failed|Flaky/)).not.toBeInTheDocument();
  });

  test('imports only the Scripts route stylesheet and encodes spacious typography and responsive safeguards', () => {
    expect(existsSync('src/styles/routes/scripts.css')).toBe(true);
    const stylesIndex = readFileSync('src/styles.css', 'utf8');
    const scriptsCss = readFileSync('src/styles/routes/scripts.css', 'utf8');
    const scriptsSource = readFileSync('src/pages/Scripts.tsx', 'utf8');

    expect(stylesIndex).toContain("@import './styles/routes/scripts.css';");
    expect(scriptsSource.match(/\buseQuery\s*\(/g)).toHaveLength(1);
    expect(scriptsSource).not.toMatch(/useMutation|type=["']file["']|FormData|uploadScripts|\/upload/i);
    expect(scriptsCss).toMatch(
      /\.scripts-page\s*>\s*\.page-header\s*\{[^}]*height:\s*118px;[^}]*margin-bottom:\s*24px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-summary\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*16px;[^}]*margin-bottom:\s*24px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-summary-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*136px;[^}]*padding:\s*20px 24px 18px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-table-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*606px;[^}]*padding:\s*24px 28px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-toolbar\s*\{[^}]*width:\s*calc\(100% \+ 2px\);[^}]*min-height:\s*48px;[^}]*gap:\s*24px;[^}]*margin-left:\s*-1px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-table-scroll\s*\{[^}]*width:\s*calc\(100% \+ 2px\);[^}]*height:\s*430px;[^}]*flex:\s*0 0 430px;[^}]*margin-left:\s*-1px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-search-control\s*\{[^}]*width:\s*430px;[^}]*height:\s*48px;[^}]*min-height:\s*48px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-search-control\s*\{[^}]*background:\s*var\(--color-surface\);/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-filter-control\s*\{[^}]*background:\s*var\(--color-surface\);/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-filter-control--object\s*\{[^}]*width:\s*230px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-filter-control--level\s*\{[^}]*width:\s*150px;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-filter-control--feature\s*\{[^}]*width:\s*180px;/
    );
    expect(scriptsCss).toMatch(/\.scripts-table thead tr\s*\{[^}]*height:\s*44px;/);
    expect(scriptsCss).toMatch(/\.scripts-table tbody tr\s*\{[^}]*height:\s*74px;/);
    expect(scriptsCss).toMatch(/\.scripts-summary-card h2\s*\{[^}]*font-size:\s*15px;[^}]*line-height:\s*var\(--type-body-line\);/);
    expect(scriptsCss).toMatch(/\.scripts-table\s*\{[^}]*font-size:\s*14px;/);
    expect(scriptsCss).toMatch(/\.scripts-table th\s*\{[^}]*font-size:\s*13px;[^}]*line-height:\s*20px;/);
    for (const [column, width] of [[1, 360], [2, 230], [3, 100], [4, 150], [5, 140], [6, 260]]) {
      expect(scriptsCss).toMatch(
        new RegExp(`\\.scripts-table th:nth-child\\(${column}\\)[^}]*width:\\s*${width}px;`)
      );
    }
    const tableScrollRule = scriptsCss.match(/\.scripts-table-scroll\s*\{[^}]*\}/)?.[0] ?? '';
    expect(tableScrollRule).not.toMatch(/border(?:-radius)?:|background:|box-shadow:|padding:/);
    expect(scriptsCss).toMatch(
      /\.scripts-table th,\s*\.scripts-table td\s*\{[^}]*padding:\s*0;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-table th\s*\{[^}]*border-bottom:\s*1px solid var\(--color-outline\);[^}]*background:\s*transparent;/
    );
    expect(scriptsCss).toMatch(
      /\.scripts-table td\s*\{[^}]*border-bottom:\s*1px solid var\(--color-outline\);/
    );
    expect(scriptsCss).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*\.scripts-filter-control[^}]*min-height:\s*48px;/
    );
  });
});
