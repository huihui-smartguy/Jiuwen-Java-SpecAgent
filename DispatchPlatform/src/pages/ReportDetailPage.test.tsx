import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import { ReportDetailPage } from './ReportDetailPage';

function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response);
}

function LocationProbe() {
  return <output data-testid="location-path">{useLocation().pathname}</output>;
}

function renderDetail(runtimeConfig = resolveRuntimeConfig({ enableMockFallback: false })) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/results/report-detail-1']}>
        <Routes>
          <Route
            path="/results/:reportId"
            element={(
              <ReportDetailPage
                language="en"
                selectedSut={runtimeConfig.sutTargets[0]}
                runtimeConfig={runtimeConfig}
              />
            )}
          />
          <Route path="/results" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const reportResponse = {
  success: true,
  report: {
    id: 'report-detail-1',
    title: 'Release verification report',
    software_version: 'AgentPlatform 3.5.2 build 20260715.1',
    scope: {
      product: 'AgentPlatform',
      scenes: ['API'],
      features: ['Save API'],
      levels: ['L1'],
      total_scripts: 7
    },
    environment: {
      execute_mode: 'pytest',
      env_vars: { A2A_BASE_URL: 'http://sut.example.test' },
      sut: {
        software_version: 'AgentPlatform 3.5.2 build 20260715.1',
        base_url: 'http://sut.example.test',
        server_info: 'sut.example.test:80'
      },
      test_runner: {
        os: 'Linux',
        python_version: '3.11.9',
        pytest_version: '8.3.3',
        exec_host: 'runner-01'
      }
    },
    summary: {
      total: 2,
      pass: 1,
      failed: 1,
      skipped: 0,
      running: 0,
      success_rate: 50,
      total_duration_seconds: 12,
      by_feature: [{
        feature: 'Save API',
        total: 2,
        pass: 1,
        failed: 1,
        skipped: 0,
        success_rate: 50
      }]
    },
    conclusion: {
      passed: false,
      verdict: 'Blocked',
      reason: 'Overall success gate failed',
      gates: [{
        name: 'Overall success rate',
        required: '95%',
        actual: '50%',
        passed: false
      }]
    },
    risks: [{
      level: 'high',
      category: 'Server error',
      title: 'Save endpoint returned 500',
      count: 1,
      evidence: ['save_api_test: status 500'],
      recommendation: 'Fix the server error before release.'
    }],
    result_data: [{
      script_id: 'script-save',
      filename: 'save_api_test.py',
      level: 'L1',
      scene: 'API',
      feature: 'Save API',
      execute_mode: 'pytest',
      status: 'failed',
      pytest_status: 'FAILED',
      duration_seconds: 12,
      started_at: '2026-07-15T09:00:00',
      completed_at: '2026-07-15T09:00:12',
      error_message: 'AssertionError: status 500',
      failure_detail: 'bounded detail',
      failure_source: 'log_file',
      log_file: '/srv/private/results/execution.log',
      log_download_url: '/api/download/public/execution.log',
      task_id: 'task-report-source'
    }],
    time_start: '2026-07-15T09:00:00',
    time_end: '2026-07-15T10:00:00',
    created_at: '2026-07-15T10:15:00',
    created_by: 'codex-verification'
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Report detail', () => {
  test('renders the canonical version, immutable provenance, public downloads, gates, environment, and case results', async () => {
    const runtimeConfig = resolveRuntimeConfig({
      enableMockFallback: false,
      apiBaseUrl: '/testwise/api',
      sutTargets: [{
        ...resolveRuntimeConfig().sutTargets[0],
        apiBaseUrl: '/testwise/api'
      }]
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      expect(String(input)).toBe('/testwise/api/reports/report-detail-1');
      return json(reportResponse);
    });

    renderDetail(runtimeConfig);

    expect(await screen.findByRole('heading', { name: 'Release verification report' })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('Overall success gate failed')).toBeInTheDocument();
    expect(screen.getByText('Overall success rate')).toBeInTheDocument();
    expect(screen.getByText('Save endpoint returned 500')).toBeInTheDocument();
    expect(screen.getByText('runner-01')).toBeInTheDocument();
    expect(screen.getByText('save_api_test.py')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Provenance & scope' })).toBeInTheDocument();
    expect(screen.getByText('Unbound / unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Persisted and immutable/)).toBeInTheDocument();
    expect(screen.getByText('Actual executed rows')).toBeInTheDocument();
    expect(screen.getByText('Registered scripts in scope')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByText('task-report-source')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('undefined');
    expect(screen.getByRole('link', { name: 'Download Markdown' })).toHaveAttribute(
      'href',
      '/testwise/api/reports/report-detail-1/download?format=md'
    );
    expect(screen.getByRole('link', { name: 'Download HTML' })).toHaveAttribute(
      'href',
      '/testwise/api/reports/report-detail-1/download?format=html'
    );
    expect(screen.getByRole('link', { name: 'Download case log' })).toHaveAttribute(
      'href',
      '/testwise/api/download/public/execution.log'
    );
    expect(screen.queryByText('/srv/private/results/execution.log')).not.toBeInTheDocument();
  });

  test('treats a zero-row report as neutral even when the backend verdict says passed', async () => {
    const zeroResultResponse = {
      success: true,
      report: {
        ...reportResponse.report,
        id: 'report-empty',
        title: 'Empty release report',
        software_version: 'release-empty',
        scope: {
          ...reportResponse.report.scope,
          total_scripts: 7
        },
        summary: {
          ...reportResponse.report.summary,
          total: 0,
          pass: 0,
          failed: 0,
          skipped: 0,
          success_rate: 100,
          total_duration_seconds: 0,
          by_feature: []
        },
        conclusion: {
          passed: true,
          verdict: 'Passed',
          reason: 'Backend generated a passing gate for an empty report',
          gates: [{
            name: 'Overall success rate',
            required: '95%',
            actual: '100%',
            passed: true
          }]
        },
        risks: [],
        result_data: []
      }
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(zeroResultResponse));

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Empty release report' })).toBeInTheDocument();
    expect(screen.getAllByText('No matching execution data').length).toBeGreaterThan(0);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Passed$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Overall success rate')).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be judged as passed or failed/)).toBeInTheDocument();
  });

  test('distinguishes an all-passed report with no detail rows from a zero-match report', async () => {
    const allPassedResponse = {
      success: true,
      report: {
        ...reportResponse.report,
        id: 'report-all-passed',
        title: 'All passed report',
        summary: {
          ...reportResponse.report.summary,
          total: 2,
          pass: 2,
          failed: 0,
          skipped: 0,
          success_rate: 100,
          total_duration_seconds: 3,
          by_feature: []
        },
        conclusion: {
          passed: true,
          verdict: 'Passed',
          reason: 'All executed cases passed',
          gates: []
        },
        risks: [],
        result_data: []
      }
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(allPassedResponse));

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'All passed report' })).toBeInTheDocument();
    expect(screen.getAllByText('All executed cases passed')).toHaveLength(2);
    expect(screen.queryByText('No matching execution data')).not.toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  test('deletes only after explicit confirmation and returns to the report list', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (init?.method === 'DELETE') {
        return json({ success: true, message: 'deleted' });
      }
      return json(reportResponse);
    });
    const user = userEvent.setup();
    renderDetail();

    await screen.findByRole('heading', { name: 'Release verification report' });
    const moreActions = screen.getByRole('button', { name: 'More report actions' });
    await user.click(moreActions);
    await user.click(screen.getByRole('button', { name: 'Delete report' }));
    let confirmation = screen.getByRole('dialog', { name: 'Delete report?' });
    expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Delete report?' })).not.toBeInTheDocument();
    expect(moreActions).toHaveFocus();
    await user.click(moreActions);
    await user.click(screen.getByRole('button', { name: 'Delete report' }));
    confirmation = screen.getByRole('dialog', { name: 'Delete report?' });
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    await user.click(within(confirmation).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      '/api/reports/report-detail-1',
      { method: 'DELETE', headers: { Accept: 'application/json' } }
    ));
    expect(await screen.findByTestId('location-path')).toHaveTextContent('/results');
  });

  test('shows an explicit API error and never requests report data in mock mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const runtimeConfig = resolveRuntimeConfig({ enableMockFallback: true });
    const view = renderDetail(runtimeConfig);

    expect(screen.getByRole('alert')).toHaveTextContent('Persisted reports are unavailable in demo mode.');
    expect(fetchSpy).not.toHaveBeenCalled();
    view.unmount();

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({
      success: false,
      message: 'Report not found'
    }, 404));
    renderDetail(resolveRuntimeConfig({ enableMockFallback: false }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Report not found');
  });
});
