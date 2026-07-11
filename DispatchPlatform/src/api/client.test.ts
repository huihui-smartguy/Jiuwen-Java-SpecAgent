import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createTask,
  getFeatures,
  getScripts,
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
    await createTask(api, { script_name: ['login_test', 'logout_test'] });

    expect(fetchSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ product: '高码java', scene: '场景', level: 'L1' })
      })
    );
    expect(fetchSpy.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ script_name: ['login_test', 'logout_test'] })
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
});
