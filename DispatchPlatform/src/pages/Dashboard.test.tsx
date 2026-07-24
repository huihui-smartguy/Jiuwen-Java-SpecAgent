import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import type {
  Language,
  OverviewFeatureQuality,
  OverviewQualityDataStatus,
  OverviewQualityResponse,
  OverviewQualityVersionsResponse,
  RuntimeConfig,
  SutTarget
} from '../types';
import { Dashboard } from './Dashboard';

const VERSION_715 = '715:0.2.0.beta3.post3';
const VERSION_615 = '615:0.2.0.beta3';
const overviewStyles = readFileSync('src/styles/routes/overview.css', 'utf8');
const dashboardSource = readFileSync('src/pages/Dashboard.tsx', 'utf8');

const selectedSut: SutTarget = {
  id: 'unified-api',
  name: '合一版本 API',
  product: '合一版本',
  scene: 'API',
  version: 'catalog-r1',
  apiBaseUrl: '/api',
  status: 'healthy'
};

const englishAliasSut: SutTarget = {
  ...selectedSut,
  id: 'unified-version-api',
  name: 'Unified Version API',
  product: 'Unified Version'
};

const runtimeConfig = resolveRuntimeConfig({
  defaultLanguage: 'zh',
  enableMockFallback: false,
  sutTargets: [selectedSut]
});

const features615: OverviewFeatureQuality[] = [
  ['overview', '总览', 'Overview', 62, 1, 0, 0, 1, 100],
  ['assetPlaza', '资产广场', 'Asset Plaza', 215, 8, 2, 25, 2, 25],
  ['agentManagement', '智能体管理', 'Agent Management', 1608, 255, 97, 38.04, 97, 38.04],
  ['componentLibrary', '组件库', 'Component Library', 648, 73, 18, 24.66, 18, 24.66],
  ['devConfig', '开发配置', 'Development Configuration', 316, 30, 9, 30, 9, 30],
  ['teamSpaceManagement', '团队空间管理', 'Team Space Management', 215, 12, 4, 33.33, 4, 33.33],
  ['envManagement', '环境管理', 'Environment Management', 43, 9, 1, 11.11, 1, 11.11]
].map(([
  feature_key,
  label_zh,
  label_en,
  execution_script_count,
  issues_found_total,
  critical_issue_count,
  critical_issue_ratio,
  resolved_issue_count,
  issue_resolution_rate
]) => ({
  feature_key: String(feature_key),
  label_zh: String(label_zh),
  label_en: String(label_en),
  execution_script_count: Number(execution_script_count),
  issues_found_total: Number(issues_found_total),
  critical_issue_count: Number(critical_issue_count),
  critical_issue_ratio: Number(critical_issue_ratio),
  resolved_issue_count: Number(resolved_issue_count),
  issue_resolution_rate: Number(issue_resolution_rate)
}));

const features715: OverviewFeatureQuality[] = [
  ['overview', '总览', 'Overview', 68, 1, 0, 0, 1, 100],
  ['assetPlaza', '资产广场', 'Asset Plaza', 232, 6, 1, 16.67, 1, 16.67],
  ['agentManagement', '智能体管理', 'Agent Management', 1705, 201, 68, 33.83, 68, 33.83],
  ['componentLibrary', '组件库', 'Component Library', 710, 55, 12, 21.82, 12, 21.82],
  ['devConfig', '开发配置', 'Development Configuration', 338, 22, 6, 27.27, 6, 27.27],
  ['teamSpaceManagement', '团队空间管理', 'Team Space Management', 238, 8, 2, 25, 2, 25],
  ['envManagement', '环境管理', 'Environment Management', 63, 6, 1, 16.67, 1, 16.67]
].map(([
  feature_key,
  label_zh,
  label_en,
  execution_script_count,
  issues_found_total,
  critical_issue_count,
  critical_issue_ratio,
  resolved_issue_count,
  issue_resolution_rate
]) => ({
  feature_key: String(feature_key),
  label_zh: String(label_zh),
  label_en: String(label_en),
  execution_script_count: Number(execution_script_count),
  issues_found_total: Number(issues_found_total),
  critical_issue_count: Number(critical_issue_count),
  critical_issue_ratio: Number(critical_issue_ratio),
  resolved_issue_count: Number(resolved_issue_count),
  issue_resolution_rate: Number(issue_resolution_rate)
}));

function versionsResponse(
  revision = 'quality-rev-1'
): OverviewQualityVersionsResponse {
  return {
    success: true,
    schema_version: '1.0',
    revision,
    generated_at: '2026-07-24T06:00:00Z',
    product: { key: 'unified', label: '合一版本' },
    versions: [
      {
        version: VERSION_715,
        label: `715 · ${VERSION_715.slice(4)}`,
        data_status: 'modeled',
        is_default: true,
        generated_at: '2026-07-24T06:00:00Z'
      },
      {
        version: VERSION_615,
        label: `615 · ${VERSION_615.slice(4)}`,
        data_status: 'authoritative',
        is_default: false,
        generated_at: '2026-07-23T06:00:00Z'
      }
    ]
  };
}

function qualityResponse(
  version = VERSION_715,
  dataStatus: OverviewQualityDataStatus = version === VERSION_615 ? 'authoritative' : 'modeled'
): OverviewQualityResponse {
  const is615 = version === VERSION_615;
  const passRate = is615 ? 85.42 : 89.18;
  const qualityScore = is615 ? 81.4 : 86.7;
  return {
    success: true,
    schema_version: '1.0',
    revision: `quality-${version}`,
    generated_at: '2026-07-24T06:00:00Z',
    data_status: dataStatus,
    filters: {
      product: '合一版本',
      version,
      dimension: 'basic_function'
    },
    core: {
      total_case_count: is615 ? 3107 : 3354,
      passed_case_count: is615 ? 2654 : 2991,
      non_passed_case_count: is615 ? 453 : 363,
      pass_rate: passRate,
      quality_score: qualityScore,
      score_formula_version: 'v1',
      score_inputs: {
        population_scope: 'approved_version_quality_assessment',
        pass_rate: passRate,
        issue_resolution_rate: is615 ? 77.92 : 85,
        critical_issue_ratio: is615 ? 28.92 : 20.39,
        weights: {
          pass_rate: 0.6,
          issue_resolution_rate: 0.25,
          non_critical_ratio: 0.15
        }
      }
    },
    features: is615 ? features615 : features715,
    coverage: {
      status: dataStatus === 'partial' ? 'partial' : 'complete',
      source_type: is615 ? 'quality_snapshot' : 'modeled_snapshot',
      feature_issue_count_total: is615 ? 388 : 299,
      unmapped_issue_count: dataStatus === 'partial' ? 12 : 0
    }
  };
}

function jsonResponse(body: unknown, status = 200, etag = '"quality-etag"') {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag
    }
  }));
}

function installQualityBackend(options: {
  qualityStatus?: OverviewQualityDataStatus;
  qualityHttpStatus?: number;
  emptyVersions?: boolean;
} = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input), 'http://local.test');
    if (url.pathname.endsWith('/quality/overview/versions')) {
      const body = versionsResponse();
      return jsonResponse({
        ...body,
        versions: options.emptyVersions ? [] : body.versions
      });
    }
    if (url.pathname.endsWith('/quality/overview')) {
      if (options.qualityHttpStatus) {
        return jsonResponse({
          success: false,
          error: {
            code: options.qualityHttpStatus === 404
              ? 'QUALITY_SNAPSHOT_NOT_FOUND'
              : 'QUALITY_SERVICE_ERROR',
            message: 'Quality snapshot unavailable',
            details: {
              product: url.searchParams.get('product'),
              version: url.searchParams.get('version'),
              dimension: url.searchParams.get('dimension')
            }
          }
        }, options.qualityHttpStatus);
      }
      return jsonResponse(qualityResponse(
        url.searchParams.get('version') ?? VERSION_715,
        options.qualityStatus
      ));
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

interface RenderOptions {
  language?: Language;
  config?: RuntimeConfig;
  sut?: SutTarget;
  client?: QueryClient;
}

function dashboardElement({
  language = 'zh',
  config = runtimeConfig,
  sut = selectedSut,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  })
}: RenderOptions = {}) {
  return {
    client,
    element: (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Dashboard
            language={language}
            selectedSut={sut}
            activeTask={null}
            runtimeConfig={config}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )
  };
}

function renderDashboard(options: RenderOptions = {}) {
  const prepared = dashboardElement(options);
  return {
    client: prepared.client,
    ...render(prepared.element)
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Overview live quality integration', () => {
  test('loads one atomic L0 and Basic snapshot and renders the seven-row matrix', async () => {
    installQualityBackend();
    renderDashboard();

    expect(screen.getByRole('status')).toHaveAttribute('data-quality-state', 'loading');
    const l0 = await screen.findByRole('region', { name: '全局质量' });
    const l1 = screen.getByRole('region', { name: '分维度质量评估' });

    expect(within(l0).getByRole('img', { name: '综合质量 86.7' })).toBeInTheDocument();
    expect(within(l0).getByText('3354')).toBeInTheDocument();
    expect(within(l0).getByText('89.2%')).toBeInTheDocument();
    expect(within(l0).getAllByText('363').length).toBeGreaterThan(0);
    expect(screen.queryByText('模型构造快照')).not.toBeInTheDocument();
    expect(within(l0).queryByText(VERSION_715)).not.toBeInTheDocument();
    expect(l0.querySelector('[data-quality-provenance]')).toBeNull();
    expect(l1.querySelector('[data-quality-provenance]')).toBeNull();

    const table = within(l1).getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    expect(within(table).getByRole('rowheader', { name: '智能体管理' })).toBeInTheDocument();
    for (const heading of [
      '特性',
      '执行脚本数量',
      '发现问题总数',
      '严重问题数量',
      '严重问题占比',
      '问题解决数量',
      '问题解决率'
    ]) {
      expect(within(table).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
  });

  test('places the global version selector immediately before New Task and exposes exactly two versions', async () => {
    const user = userEvent.setup();
    installQualityBackend();
    renderDashboard();

    const trigger = await screen.findByRole('button', { name: `选择版本: ${VERSION_715}` });
    const newTask = screen.getByRole('link', { name: /新建任务/ });
    expect(trigger.compareDocumentPosition(newTask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trigger.closest('.overview-header-actions')).toContainElement(newTask);
    expect(trigger.closest('.overview-l1-card')).toBeNull();

    await user.click(trigger);
    expect(
      within(screen.getByRole('listbox', { name: '选择版本' }))
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual([VERSION_715, VERSION_615]);
  });

  test('switching version replaces L0 and Basic L1 together with the authoritative 615 snapshot', async () => {
    const user = userEvent.setup();
    installQualityBackend();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: `选择版本: ${VERSION_715}` }));
    await user.click(screen.getByRole('option', { name: VERSION_615 }));

    const l0 = await screen.findByRole('region', { name: '全局质量' });
    await waitFor(() => {
      expect(within(l0).getByRole('img', { name: '综合质量 81.4' })).toBeInTheDocument();
    });
    expect(within(l0).getByText('3107')).toBeInTheDocument();
    expect(within(l0).getByText('85.4%')).toBeInTheDocument();
    expect(within(l0).getAllByText('453').length).toBeGreaterThan(0);
    expect(screen.queryByText('权威质量快照')).not.toBeInTheDocument();
    expect(within(l0).queryByText(VERSION_615)).not.toBeInTheDocument();
    expect(l0.querySelector('[data-quality-provenance]')).toBeNull();
    const overviewRow = screen.getByRole('rowheader', { name: '总览' }).closest('tr')!;
    expect(within(overviewRow).getAllByRole('cell').map((cell) => cell.textContent))
      .toEqual(['62', '1', '0', '0%', '1', '100%']);
    const agentRow = screen.getByRole('rowheader', { name: '智能体管理' }).closest('tr')!;
    expect(within(agentRow).getAllByRole('cell').map((cell) => cell.textContent))
      .toEqual(['1608', '255', '97', '38.04%', '97', '38.04%']);
    const componentRow = screen.getByRole('rowheader', { name: '组件库' }).closest('tr')!;
    expect(within(componentRow).getAllByRole('cell').map((cell) => cell.textContent))
      .toEqual(['648', '73', '18', '24.66%', '18', '24.66%']);
  });

  test('Basic keeps Dimension Quality and replaces the prior overall and issue cards', async () => {
    installQualityBackend();
    renderDashboard();
    await screen.findByRole('region', { name: '全局质量' });

    const l1 = screen.getByRole('region', { name: '分维度质量评估' });
    expect(within(l1).getAllByText('维度质量').length).toBeGreaterThan(0);
    expect(within(l1).getByText('FEATURE QUALITY ASSESSMENT · 特性质量评估'))
      .toBeInTheDocument();
    expect(within(l1).queryByText('整体质量评估', { exact: true })).not.toBeInTheDocument();
    expect(within(l1).queryByText('发现问题', { exact: true })).not.toBeInTheDocument();
    expect(within(l1).queryByText(/评分公式|weighted-quality-v1/)).not.toBeInTheDocument();
  });

  test('renders null rate denominators as an em dash', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/quality/overview/versions')) {
        return jsonResponse(versionsResponse());
      }
      const response = qualityResponse();
      response.features[0] = {
        ...response.features[0],
        critical_issue_ratio: null,
        issue_resolution_rate: null
      };
      return jsonResponse(response);
    });
    renderDashboard();

    const overviewRow = (await screen.findByRole('rowheader', { name: '总览' })).closest('tr')!;
    expect(within(overviewRow).getAllByText('—')).toHaveLength(2);
  });

  test('keeps DFX, Scenario, and Performance fixture structures while labelling them simulated', async () => {
    const user = userEvent.setup();
    installQualityBackend();
    renderDashboard({ sut: englishAliasSut });
    await screen.findByRole('region', { name: '全局质量' });

    await user.click(screen.getByRole('button', { name: '选择质量维度: 基础功能' }));
    await user.click(screen.getByRole('option', { name: 'DFX' }));
    expect(
      within(screen.getByRole('region', { name: '通过的测试脚本' })).getByText('162')
    ).toBeInTheDocument();
    expect(screen.getByText('示例数据 · 前端模拟')).toHaveAttribute(
      'data-quality-provenance',
      'simulated'
    );

    await user.click(screen.getByRole('button', { name: '选择质量维度: DFX' }));
    await user.click(screen.getByRole('option', { name: '场景化测试' }));
    expect(screen.getByText(/核心链路可用，复杂场景覆盖仍需加强/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择质量维度: 场景化测试' }));
    await user.click(screen.getByRole('option', { name: '性能' }));
    expect(screen.getAllByText('198 ms')).toHaveLength(2);
    expect(screen.getByRole('img', { name: /性能趋势 · 最近 6 个版本/ })).toBeInTheDocument();
  });

  test('exposes partial backend provenance without replacing valid data', async () => {
    installQualityBackend({ qualityStatus: 'partial' });
    renderDashboard();

    const l0 = await screen.findByRole('region', { name: '全局质量' });
    const l1 = screen.getByRole('region', { name: '分维度质量评估' });
    expect(within(l0).getByText('部分质量数据')).toHaveAttribute(
      'data-quality-provenance',
      'l0-partial'
    );
    expect(within(l1).getByText('部分质量数据')).toHaveAttribute(
      'data-quality-provenance',
      'partial'
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  test('retains the last valid snapshot and marks it stale after a refresh failure', async () => {
    const user = userEvent.setup();
    let failQuality = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname.endsWith('/quality/overview/versions')) {
        return jsonResponse(versionsResponse());
      }
      return failQuality
        ? jsonResponse({
            success: false,
            error: { code: 'QUALITY_SERVICE_ERROR', message: 'offline' }
          }, 503)
        : jsonResponse(qualityResponse());
    });
    const { client } = renderDashboard();
    await screen.findByRole('region', { name: '全局质量' });

    failQuality = true;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['overview-quality'] });
    });

    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: '分维度质量评估' }))
        .getByText('缓存质量数据 · 更新失败')).toHaveAttribute(
        'data-quality-provenance',
        'stale'
      );
    });
    expect(within(screen.getByRole('region', { name: '全局质量' }))
      .getByText('缓存质量数据 · 更新失败')).toHaveAttribute(
      'data-quality-provenance',
      'l0-stale'
    );
    expect(screen.getByRole('table')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择质量维度: 基础功能' }));
    await user.click(screen.getByRole('option', { name: 'DFX' }));
    expect(screen.getByText('L0 · 缓存质量数据 · 更新失败')).toHaveAttribute(
      'data-quality-provenance',
      'l0-stale'
    );
    expect(screen.getByText('示例数据 · 前端模拟')).toHaveAttribute(
      'data-quality-provenance',
      'simulated'
    );
  });

  test('renders localized empty and error states with retry', async () => {
    const { unmount } = (() => {
      installQualityBackend({ qualityHttpStatus: 404 });
      return renderDashboard();
    })();
    expect(await screen.findByRole('heading', { name: '暂无质量快照' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    installQualityBackend({ qualityHttpStatus: 503 });
    renderDashboard({ language: 'en' });
    expect(await screen.findByRole('heading', { name: 'Quality snapshot unavailable' }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  test('accepts the English product alias and its canonical quality.changed event', async () => {
    class FakeEventSource {
      static instance: FakeEventSource;
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      listeners = new Map<string, Set<(event: Event) => void>>();

      constructor(readonly url: string) {
        FakeEventSource.instance = this;
      }

      addEventListener(type: string, listener: EventListener) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: EventListener) {
        this.listeners.get(type)?.delete(listener);
      }

      close() {}

      emit(type: string, payload: object) {
        const event = new MessageEvent(type, { data: JSON.stringify(payload) });
        this.listeners.get(type)?.forEach((listener) => listener(event));
      }
    }

    vi.stubGlobal('EventSource', FakeEventSource);
    const fetchSpy = installQualityBackend();
    renderDashboard({ sut: englishAliasSut });
    await screen.findByRole('region', { name: '全局质量' });
    expect(
      new URL(FakeEventSource.instance.url, 'http://local.test').searchParams.get('product')
    ).toBe('Unified Version');
    const callsBefore = fetchSpy.mock.calls.length;

    act(() => {
      FakeEventSource.instance.emit('quality.changed', {
        event: 'quality.changed',
        revision: 'quality-rev-next',
        generated_at: '2026-07-24T07:00:00Z',
        product: '合一版本',
        versions: [VERSION_715, VERSION_615]
      });
    });

    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(callsBefore + 2));
  });

  test('encodes responsive sticky matrix behavior and has no Basic mock lookup', () => {
    expect(dashboardSource).not.toContain('overviewMockData');
    expect(dashboardSource).not.toContain('getOverviewQualityMock');
    expect(dashboardSource).not.toContain('overview-version-badge');
    expect(dashboardSource).not.toContain('basic-dimension-quality__formula');
    expect(dashboardSource).not.toContain('qualityScoreFormula');
    expect(overviewStyles).toMatch(
      /\.feature-quality-table-scroll\s*\{[^}]*overflow:\s*auto;[^}]*scrollbar-gutter:\s*stable;/s
    );
    expect(overviewStyles).toMatch(
      /\.feature-quality-table thead th\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s
    );
    expect(overviewStyles).toMatch(
      /\.feature-quality-table th:first-child\s*\{[^}]*position:\s*sticky;[^}]*left:\s*0;/s
    );
    expect(overviewStyles).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*?\.basic-quality-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
    expect(overviewStyles).toMatch(
      /\.basic-quality-grid\s*\{[^}]*grid-template-columns:\s*minmax\(300px,\s*0\.42fr\)\s+minmax\(0,\s*1\.58fr\);[^}]*gap:\s*20px;/s
    );
    expect(overviewStyles).toMatch(
      /\.basic-dimension-quality\s*\{[^}]*padding:\s*24px;/s
    );
    expect(overviewStyles).toMatch(
      /\.feature-quality-card__heading p\s*\{[^}]*font-size:\s*16px;[^}]*line-height:\s*24px;/s
    );
    expect(overviewStyles).toMatch(
      /\.feature-quality-card__heading span\s*\{[^}]*font-size:\s*13px;[^}]*line-height:\s*20px;/s
    );
    expect(overviewStyles).toMatch(
      /\.feature-quality-table\s*\{[^}]*font-size:\s*var\(--type-body-size\);[^}]*line-height:\s*var\(--type-body-line\);/s
    );
    expect(overviewStyles).toMatch(
      /\.feature-quality-table th,\s*\.feature-quality-table td\s*\{[^}]*font-size:\s*var\(--type-body-size\);[^}]*line-height:\s*var\(--type-body-line\);/s
    );
    expect(overviewStyles).toMatch(
      /\.feature-quality-table th\s*\{[^}]*letter-spacing:\s*normal;[^}]*text-transform:\s*none;/s
    );
    expect(overviewStyles).toMatch(
      /\.basic-dimension-quality > \.dimension-summary-zone__eyebrow\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-ring\.is-compact \.overview-quality-ring__visual strong\s*\{[^}]*font-size:\s*28px;[^}]*line-height:\s*34px;/s
    );
    expect(overviewStyles).toMatch(
      /\.overview-quality-ring\.is-compact \.overview-quality-ring__caption\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/s
    );
    expect(overviewStyles).toMatch(
      /@media \(max-width:\s*440px\)[\s\S]*?\.feature-quality-card__heading\s*\{[^}]*flex-direction:\s*column;/s
    );
  });

  test('provides complete English copy for the live Basic view', async () => {
    installQualityBackend();
    renderDashboard({ language: 'en' });

    await screen.findByRole('region', { name: 'Global quality' });
    expect(screen.queryByText('Modeled quality snapshot')).not.toBeInTheDocument();
    expect(screen.queryByText(/Score formula|weighted-quality-v1/)).not.toBeInTheDocument();
    expect(screen.getByText('FEATURE QUALITY ASSESSMENT · Feature quality assessment'))
      .toBeInTheDocument();
    for (const heading of [
      'Feature',
      'Executed scripts',
      'Issues found',
      'Critical issues',
      'Critical issue ratio',
      'Resolved issues',
      'Issue resolution rate'
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
  });
});
