import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildApiUrl,
  cancelTask,
  createReport,
  createTask,
  deleteReport,
  getFeatures,
  getReport,
  getReportDownloadUrl,
  getScriptsForScene,
  getStatisticsSummary,
  getScripts,
  getTaskLogs,
  getTaskScriptStatus,
  getTaskStatus,
  getVersions,
  listReports,
  normalizeCreatedTask,
  normalizeTaskStatus,
  ReportOutcomeUnknownError,
  resolvePublicDownloadUrl
} from './client';

const api = { apiBaseUrl: '/api' };

function mockJson(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body)
  } as Response);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function reportListItem(
  id: string,
  version: { software_version?: string; test_version?: string }
) {
  return {
    id,
    title: `Report ${id}`,
    ...version,
    summary: {
      total: 1,
      pass: 1,
      failed: 0,
      skipped: 0,
      running: 0,
      success_rate: 100,
      total_duration_seconds: 1
    },
    conclusion: { passed: true, verdict: 'passed', reason: 'all checks passed' },
    created_at: '2026-07-15T10:00:00',
    created_by: 'system'
  };
}

describe('execution API client', () => {
  test('normalizes the observed live task log payload without inventing entries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        total: 3,
        logs: [
          { timestamp: '2026-07-13 09:00:00', level: 'INFO', message: 'Task accepted' },
          { timestamp: '2026-07-13 09:00:01', level: 'WARNING', message: 'Retrying request' },
          { timestamp: '2026-07-13 09:00:02', level: 'TRACE', message: 'Worker detail' }
        ]
      })
    );

    const result = await getTaskLogs(api, 'task_live_logs');

    expect(fetchSpy).toHaveBeenCalledWith('/api/tasks/task_live_logs/logs', {
      headers: { Accept: 'application/json' }
    });
    expect(result).toEqual({
      cursor: '3',
      entries: [
        expect.objectContaining({ timestamp: '2026-07-13 09:00:00', level: 'info', message: 'Task accepted' }),
        expect.objectContaining({ timestamp: '2026-07-13 09:00:01', level: 'warn', message: 'Retrying request' }),
        expect.objectContaining({ timestamp: '2026-07-13 09:00:02', level: 'log', message: 'Worker detail' })
      ]
    });
    expect(new Set(result.entries.map((entry) => entry.id)).size).toBe(3);
  });

  test('uses and rebases a backend-provided task log view URL through the selected environment', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({ success: true, total: 0, logs: [] })
    );

    await getTaskLogs(
      { apiBaseUrl: '/testwise/api' },
      'task_subpath',
      'http://gateway.example.test/api/tasks/task_subpath/logs'
    );

    expect(fetchSpy).toHaveBeenCalledWith('/testwise/api/tasks/task_subpath/logs', {
      headers: { Accept: 'application/json' }
    });
  });

  test('resolves a root-relative task log view URL against an absolute environment origin', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({ success: true, total: 0, logs: [] })
    );

    await getTaskLogs(
      { apiBaseUrl: 'https://backend.example.test:3443/api' },
      'task_absolute_environment',
      '/api/tasks/task_absolute_environment/logs'
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://backend.example.test:3443/api/tasks/task_absolute_environment/logs',
      { headers: { Accept: 'application/json' } }
    );
  });

  test('preserves an absolute environment path prefix when rebasing a root-relative log view URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({ success: true, total: 0, logs: [] })
    );

    await getTaskLogs(
      { apiBaseUrl: 'https://backend.example.test:3443/testwise/api' },
      'task_absolute_subpath',
      '/api/tasks/task_absolute_subpath/logs'
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://backend.example.test:3443/testwise/api/tasks/task_absolute_subpath/logs',
      { headers: { Accept: 'application/json' } }
    );
  });

  test('keeps only the newest 2,000 live log entries', async () => {
    const logs = Array.from({ length: 2004 }, (_, index) => ({
      timestamp: `2026-07-13 09:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
      level: 'DEBUG',
      message: `Line ${index}`
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({ success: true, total: logs.length, logs })
    );

    const result = await getTaskLogs(api, 'task_bounded');

    expect(result.entries).toHaveLength(2000);
    expect(result.entries[0].message).toBe('Line 4');
    expect(result.entries.at(-1)?.message).toBe('Line 2003');
  });

  test('rejects a malformed task log response explicitly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({ success: true, total: 1, logs: [{ level: 'INFO' }] })
    );

    await expect(getTaskLogs(api, 'task_malformed')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_LOG_RESPONSE'
    });
  });

  test('rejects a log snapshot whose total is not a valid full-snapshot count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        total: 2,
        logs: [{ timestamp: '2026-07-13 09:00:00', level: 'INFO', message: 'Only line' }]
      })
    );

    await expect(getTaskLogs(api, 'task_bad_total')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_LOG_RESPONSE'
    });
  });

  test('keeps an absolute API base when constructing a request URL', () => {
    expect(buildApiUrl('http://backend.example.test:3000/api', '/features', {
      product: '合一版本',
      scene: 'API'
    })).toBe('http://backend.example.test:3000/api/features?product=%E5%90%88%E4%B8%80%E7%89%88%E6%9C%AC&scene=API');
  });

  test('feature lookup uses the selected SUT product and scene', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await mockJson({ success: true, features: [], total: 0 }));

    await getFeatures(api, '高码java', '场景');

    const url = new URL(fetchSpy.mock.calls[0][0] as string, 'http://local.test');
    expect(url.pathname).toBe('/api/features');
    expect(url.searchParams.get('product')).toBe('高码java');
    expect(url.searchParams.get('scene')).toBe('场景');
  });

  test('script lookup supports feature and level filters', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await mockJson({ success: true, scripts: [], total: 0 }));

    await getScripts(api, {
      product: '高码java',
      scene: '场景',
      feature: '保存接口',
      level: 'L0'
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string, 'http://local.test');
    expect(url.pathname).toBe('/api/scripts');
    expect(url.searchParams.get('product')).toBe('高码java');
    expect(url.searchParams.get('scene')).toBe('场景');
    expect(url.searchParams.get('feature')).toBe('保存接口');
    expect(url.searchParams.get('level')).toBe('L0');
  });

  test('discovers every scene script by feature fan-out with stable de-duplication', async () => {
    const sharedFromFirstFeature = {
      id: 'script-shared',
      name: 'shared-first',
      filename: 'shared.py',
      extension: '.py',
      product: '合一版本',
      scene: 'API',
      feature: '认证',
      level: 'L0',
      size: 100,
      path: '/tests/shared.py'
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/api/features') {
        return await mockJson({
          success: true,
          product: '合一版本',
          scene: 'API',
          features: [
            { id: 'feature-auth', name: '认证', type: 'feature' },
            { id: 'feature-keys', name: '密钥管理', type: 'feature' }
          ],
          total: 2
        });
      }

      const feature = url.searchParams.get('feature');
      if (url.pathname === '/api/scripts' && feature === '认证') {
        return await mockJson({
          success: true,
          scripts: [
            sharedFromFirstFeature,
            { ...sharedFromFirstFeature, id: 'script-auth', name: 'auth-only', path: '/tests/auth.py' },
            { ...sharedFromFirstFeature, id: '', name: 'path-first', path: '/tests/by-path.py' }
          ],
          total: 3
        });
      }
      if (url.pathname === '/api/scripts' && feature === '密钥管理') {
        return await mockJson({
          success: true,
          scripts: [
            { ...sharedFromFirstFeature, name: 'shared-second', feature: '密钥管理' },
            { ...sharedFromFirstFeature, id: 'script-keys', name: 'keys-only', feature: '密钥管理', path: '/tests/keys.py' },
            { ...sharedFromFirstFeature, id: '', name: 'path-second', feature: '密钥管理', path: '/tests/by-path.py' }
          ],
          total: 3
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });

    const result = await getScriptsForScene(api, '合一版本', 'API');

    expect(result.scripts.map((script) => script.name)).toEqual([
      'shared-first',
      'auth-only',
      'path-first',
      'keys-only'
    ]);
    expect(result.total).toBe(4);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const requestUrls = fetchSpy.mock.calls.map(([input]) => new URL(String(input), 'http://local.test'));
    expect(requestUrls[0].pathname).toBe('/api/features');
    expect(requestUrls.slice(1).map((url) => url.searchParams.get('feature'))).toEqual([
      '认证',
      '密钥管理'
    ]);
    requestUrls.slice(1).forEach((url) => {
      expect(url.searchParams.get('product')).toBe('合一版本');
      expect(url.searchParams.get('scene')).toBe('API');
    });
  });

  test('task creation posts the selected feature trigger payload', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        task_id: 'task_20260710_143000_abc123',
        status: 'pending',
        trigger_type: 'feature',
        message: '任务已创建，准备开始执行'
      })
    );

    const result = await createTask(api, {
      product: '高码java',
      scene: '场景',
      feature: '保存接口'
    });

    expect(result.task_id).toBe('task_20260710_143000_abc123');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          product: '高码java',
          scene: '场景',
          feature: '保存接口'
        })
      })
    );
  });

  test('cancellation preserves the live acknowledgement instead of inventing a terminal task state', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        task_id: 'task_live_cancelling',
        previous_status: 'running',
        message: '已发送取消信号,任务将安全退出'
      })
    );

    const result = await cancelTask(api, 'task_live_cancelling');

    expect(fetchSpy).toHaveBeenCalledWith('/api/tasks/task_live_cancelling', {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    });
    expect(result).toEqual({
      success: true,
      task_id: 'task_live_cancelling',
      previous_status: 'running',
      message: '已发送取消信号,任务将安全退出'
    });
  });

  test('normalizes a live queued task creation response and derives its trigger', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        task_id: 'task_live_queued',
        status: 'queued',
        queue_position: 2,
        total_scripts: 5,
        message: '任务已加入队列',
        created_at: '2026-07-11T09:00:00'
      })
    );

    const result = await createTask(api, {
      product: '合一版本',
      scene: 'API',
      feature: 'API密钥管理'
    });

    expect(result).toMatchObject({
      success: true,
      task_id: 'task_live_queued',
      status: 'pending',
      trigger_type: 'feature',
      backend_status: 'queued',
      queue_position: 2,
      total_scripts: 5
    });
  });

  test('retains creation queue metadata before the first status poll', () => {
    const task = normalizeCreatedTask({
      success: true,
      task_id: 'task_live_queued',
      status: 'pending',
      trigger_type: 'feature',
      backend_status: 'queued',
      queue_position: 2,
      total_scripts: 5,
      message: '任务已加入队列',
      created_at: '2026-07-11T09:00:00'
    });

    expect(task).toMatchObject({
      task_id: 'task_live_queued',
      backend_status: 'queued',
      queue_position: 2,
      progress: { total_commands: 5, completed: 0, failed: 0 }
    });
  });

  test('normalizes the live nested task response and its terminal log URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        task: {
          id: 'task_live_completed',
          product: '合一版本',
          scene: 'API',
          feature: 'API密钥管理',
          status: 'completed',
          progress: 100,
          total_scripts: 5,
          executed_scripts: 5,
          failed_scripts: 0,
          queue_position: -1,
          started_at: '2026-07-11T09:00:00',
          completed_at: '2026-07-11T09:01:00',
          log_dir: 'task_live_completed',
          download_url: 'http://testwise.local/api/download/task_live_completed/execution.log'
        }
      })
    );

    const result = await getTaskStatus(api, 'task_live_completed');
    const normalized = normalizeTaskStatus(result);

    expect(result).toMatchObject({
      task_id: 'task_live_completed',
      status: 'success',
      backend_status: 'completed',
      queue_position: -1,
      progress: { total_commands: 5, completed: 5, failed: 0 },
      logs: {
        file_path: 'task_live_completed',
        download_url: 'http://testwise.local/api/download/task_live_completed/execution.log'
      }
    });
    expect(normalized.canExportLogs).toBe(true);
    expect(normalized.logDownloadUrl).toBe('http://testwise.local/api/download/task_live_completed/execution.log');
  });

  test('rebases a backend-generated absolute log URL through a same-origin subpath API gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        task: {
          id: 'task_live_subpath',
          status: 'completed',
          total_scripts: 1,
          executed_scripts: 1,
          failed_scripts: 0,
          log_dir: 'task_live_subpath',
          download_url: 'http://gateway.example.test/api/download/task_live_subpath/execution.log'
        }
      })
    );

    const result = await getTaskStatus(
      { apiBaseUrl: '/testwise/api' },
      'task_live_subpath'
    );

    expect(result.logs?.download_url).toBe(
      '/testwise/api/download/task_live_subpath/execution.log'
    );
  });

  test('rebases a documented root-relative log URL through a same-origin subpath API gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        task_id: 'task_documented_subpath',
        status: 'success',
        trigger_type: 'feature',
        logs: {
          file_path: 'task_documented_subpath',
          download_url: '/api/download/task_documented_subpath/execution.log'
        }
      })
    );

    const result = await getTaskStatus(
      { apiBaseUrl: '/testwise/api' },
      'task_documented_subpath'
    );

    expect(result.logs?.download_url).toBe(
      '/testwise/api/download/task_documented_subpath/execution.log'
    );
  });

  test('task creation posts level and explicit script triggers', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        await mockJson({
          success: true,
          task_id: 'task_level',
          status: 'pending',
          trigger_type: 'level',
          message: 'created'
        })
      )
      .mockResolvedValueOnce(
        await mockJson({
          success: true,
          task_id: 'task_scripts',
          status: 'pending',
          trigger_type: 'scripts',
          message: 'created'
        })
      );

    await createTask(api, { product: '高码java', scene: '场景', level: 'L1' });
    await createTask(api, {
      product: '高码java',
      scene: '场景',
      feature: '保存接口',
      script_name: ['login_test', 'logout_test']
    });

    expect(fetchSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ product: '高码java', scene: '场景', level: 'L1' })
      })
    );
    expect(fetchSpy.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          product: '高码java',
          scene: '场景',
          feature: '保存接口',
          script_name: ['login_test', 'logout_test']
        })
      })
    );
  });

  test('discovers backend test versions using the live response shape', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        default_version: 'release1',
        versions: [
          {
            code: 'release1',
            name: 'Release 1',
            description: '第一个发布版本',
            created_at: '2026-07-13',
            is_default: true
          }
        ]
      })
    );

    const result = await getVersions(api);

    expect(fetchSpy).toHaveBeenCalledWith('/api/versions', {
      headers: { Accept: 'application/json' }
    });
    expect(result.default_version).toBe('release1');
    expect(result.versions[0]).toMatchObject({ code: 'release1', is_default: true });
  });

  test('queries Object-scoped statistics and task script status without changing their wire data', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        await mockJson({
          success: true,
          message: '统计查询成功',
          data: {
            summary: {
              total_scripts: 10,
              executed_scripts: 8,
              unexecuted_scripts: 2,
              pass_count: 7,
              failed_count: 1,
              running_count: 0,
              pass_rate: '87.50%',
              execution_rate: '80.00%'
            },
            breakdown: [],
            filters: { product: '合一版本', scene: 'API' }
          }
        })
      )
      .mockResolvedValueOnce(
        await mockJson({
          success: true,
          task_id: 'task-1',
          scripts_status: [
            {
              script_id: 'script-1',
              script_name: 'test_api.py',
              version: 'release1',
              status: 'pass',
              started_at: '2026-07-15T10:00:00',
              completed_at: '2026-07-15T10:00:03',
              duration_seconds: 3,
              error_message: null
            }
          ],
          summary: { todo_count: 0, pass_count: 1, failed_count: 0, running_count: 0 }
        })
      );

    const statistics = await getStatisticsSummary(api, {
      product: '合一版本',
      scene: 'API'
    });
    const scriptStatus = await getTaskScriptStatus(api, 'task-1');

    expect(new URL(fetchSpy.mock.calls[0][0] as string, 'http://local.test').searchParams.get('product')).toBe('合一版本');
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/tasks/task-1/script-status');
    expect(statistics.data.summary.pass_rate).toBe('87.50%');
    expect(scriptStatus.scripts_status[0].error_message).toBeNull();
  });

  test('creates an entire-scene task with its selected test version and preserves the version response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({
        success: true,
        task_id: 'task-scene',
        status: 'queued',
        message: '任务已加入队列'
      })
    );

    const result = await createTask(api, {
      product: '合一版本',
      scene: 'API',
      version: 'release1'
    });

    expect(fetchSpy.mock.calls[0][1]).toEqual(expect.objectContaining({
      body: JSON.stringify({ product: '合一版本', scene: 'API', version: 'release1' })
    }));
    expect(result).toMatchObject({ trigger_type: 'scene', version: 'release1' });
  });

  test('creates one canonical execution/report version without an independent test version', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await mockJson({ success: true, report_id: 'report-1' })
    );
    const payload = {
      software_version: 'release1',
      scope: { product: '合一版本', scenes: ['API'] },
      time_window: ['2026-07-15T09:00:00', '2026-07-15T10:00:00'] as [string, string]
    };

    const created = await createReport(api, payload);

    expect(created.report_id).toBe('report-1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ ...payload, test_version: 'release1' })
    }));
    const posted = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(posted.software_version).toBe(posted.test_version);
  });

  test('scans prefix-filtered backend pages, normalizes versions, and paginates exact matches locally', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await mockJson({
        success: true,
        total: 6,
        reports: [
          reportListItem('exact-first', { software_version: 'release1', test_version: 'legacy-other' }),
          reportListItem('prefix', { software_version: 'release10' }),
          reportListItem('legacy-exact', { test_version: 'release1' })
        ]
      }))
      .mockResolvedValueOnce(await mockJson({
        success: true,
        total: 6,
        reports: [
          reportListItem('exact-first', { software_version: 'release1' }),
          reportListItem('exact-second', { software_version: 'release1' }),
          reportListItem('legacy-prefix', { test_version: 'release100' })
        ]
      }));

    const listed = await listReports(api, {
      software_version: 'release1',
      product: '合一版本',
      scene: 'API',
      limit: 1,
      offset: 1
    });

    expect(listed).toEqual({
      success: true,
      total: 3,
      reports: [expect.objectContaining({ id: 'legacy-exact', software_version: 'release1' })]
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchSpy.mock.calls[0][0] as string, 'http://local.test');
    const secondUrl = new URL(fetchSpy.mock.calls[1][0] as string, 'http://local.test');
    expect(firstUrl.pathname).toBe('/api/reports');
    expect(firstUrl.searchParams.get('software_version')).toBe('release1');
    expect(firstUrl.searchParams.get('test_version')).toBe('release1');
    expect(firstUrl.searchParams.get('product')).toBe('合一版本');
    expect(firstUrl.searchParams.get('scene')).toBe('API');
    expect(firstUrl.searchParams.get('limit')).toBe('200');
    expect(firstUrl.searchParams.get('offset')).toBe('0');
    expect(secondUrl.searchParams.get('offset')).toBe('3');
  });

  test('prefers software_version and falls back to legacy test_version only when needed', async () => {
    const detailFields = {
      scope: { product: '合一版本', scenes: ['API'] },
      environment: {},
      risks: [],
      result_data: []
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await mockJson({
        success: true,
        report: {
          ...reportListItem('current', { software_version: 'release2', test_version: 'stale-v1' }),
          ...detailFields
        }
      }))
      .mockResolvedValueOnce(await mockJson({
        success: true,
        report: {
          ...reportListItem('legacy', { test_version: 'release1' }),
          ...detailFields
        }
      }))
      .mockResolvedValueOnce(await mockJson({
        success: true,
        report: {
          ...reportListItem('invalid', {}),
          ...detailFields
        }
      }));

    await expect(getReport(api, 'current')).resolves.toMatchObject({
      report: { software_version: 'release2', test_version: 'stale-v1' }
    });
    await expect(getReport(api, 'legacy')).resolves.toMatchObject({
      report: { software_version: 'release1', test_version: 'release1' }
    });
    await expect(getReport(api, 'invalid')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_REPORT_RESPONSE'
    });
  });

  test('does not retry a transport failure and reports an unknown report outcome', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('connection reset'));

    const request = createReport(api, {
      software_version: 'release1',
      scope: { product: '合一版本', scenes: ['API'] }
    });

    await expect(request).rejects.toBeInstanceOf(ReportOutcomeUnknownError);
    await expect(request).rejects.toMatchObject({ code: 'REPORT_OUTCOME_UNKNOWN' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('aborts a timed-out report request once and reports an unknown outcome', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      })
    ));
    const request = createReport(api, {
      software_version: 'release1',
      scope: { product: '合一版本', scenes: ['API'] }
    }, { timeoutMs: 10 });
    const assertion = expect(request).rejects.toBeInstanceOf(ReportOutcomeUnknownError);

    await vi.advanceTimersByTimeAsync(11);

    await assertion;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  test('loads, downloads, and deletes persisted reports through the selected subpath gateway', async () => {
    const context = { apiBaseUrl: '/testwise/api' };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        await mockJson({
          success: true,
          report: {
            id: 'report-1',
            title: 'Report',
            software_version: 'build-1',
            test_version: 'release1',
            scope: { product: '合一版本', scenes: ['API'] },
            environment: {},
            summary: { total: 0, pass: 0, failed: 0, skipped: 0, running: 0, success_rate: 0, total_duration_seconds: 0 },
            conclusion: { passed: true, verdict: '通过', gates: [], reason: '通过' },
            risks: [],
            result_data: [],
            created_at: '2026-07-15T10:00:00',
            created_by: 'system'
          }
        })
      )
      .mockResolvedValueOnce(await mockJson({ success: true, message: '报告已删除' }));

    const detail = await getReport(context, 'report-1');
    const downloadUrl = getReportDownloadUrl(context, 'report-1', 'md');
    const deleted = await deleteReport(context, 'report-1');

    expect(fetchSpy.mock.calls[0][0]).toBe('/testwise/api/reports/report-1');
    expect(downloadUrl).toBe('/testwise/api/reports/report-1/download?format=md');
    expect(resolvePublicDownloadUrl(context, '/api/download/report-1/execution.log')).toBe(
      '/testwise/api/download/report-1/execution.log'
    );
    expect(resolvePublicDownloadUrl(
      context,
      'http://backend.example.test/api/download/report-1/execution.log'
    )).toBe('/testwise/api/download/report-1/execution.log');
    expect(fetchSpy.mock.calls[1]).toEqual([
      '/testwise/api/reports/report-1',
      { method: 'DELETE', headers: { Accept: 'application/json' } }
    ]);
    expect(detail.report.id).toBe('report-1');
    expect(deleted.message).toBe('报告已删除');
  });

  test('log export is enabled only for terminal task states with a download URL', () => {
    expect(
      normalizeTaskStatus({
        success: true,
        task_id: 'task_1',
        status: 'running',
        trigger_type: 'feature',
        logs: {
          file_path: 'logs/current.log',
          download_url: '/api/tasks/task_1/logs/download'
        }
      }).canExportLogs
    ).toBe(false);

    const completed = normalizeTaskStatus({
      success: true,
      task_id: 'task_1',
      status: 'failed',
      trigger_type: 'feature',
      logs: {
        file_path: 'logs/current.log',
        download_url: '/api/tasks/task_1/logs/download'
      }
    });

    expect(completed.canExportLogs).toBe(true);
    expect(completed.logDownloadUrl).toBe('/api/tasks/task_1/logs/download');
  });

  test('treats backend cancellation as terminal and eligible for provided log export', () => {
    const cancelled = normalizeTaskStatus({
      success: true,
      task_id: 'task_cancelled',
      status: 'cancelled' as never,
      trigger_type: 'feature',
      logs: {
        file_path: 'logs/task_cancelled.log',
        download_url: '/api/download/task_cancelled/execution.log'
      }
    });

    expect(cancelled).toMatchObject({
      uiStatus: 'cancelled',
      isTerminal: true,
      canExportLogs: true
    });
  });
});
