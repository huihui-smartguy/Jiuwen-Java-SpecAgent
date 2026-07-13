import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildApiUrl,
  cancelTask,
  createTask,
  getFeatures,
  getScripts,
  getTaskLogs,
  getTaskStatus,
  normalizeCreatedTask,
  normalizeTaskStatus
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
  vi.restoreAllMocks();
});

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
