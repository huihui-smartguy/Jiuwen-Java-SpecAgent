import { describe, expect, test } from 'vitest';
import { createApiProxy } from './viteProxy';

describe('development API proxy', () => {
  test('keeps the proxy disabled without an integration target', () => {
    expect(createApiProxy()).toBeUndefined();
  });

  test('routes /api to the configured target without changing the browser host', () => {
    expect(createApiProxy('http://backend.example.test:3000')).toEqual({
      '/api': {
        target: 'http://backend.example.test:3000',
        changeOrigin: false
      }
    });
  });

  test('also routes the configured deployment subpath API', () => {
    const proxy = createApiProxy('http://backend.example.test:3000', '/testwise/');

    expect(proxy).toMatchObject({
      '/api': {
        target: 'http://backend.example.test:3000',
        changeOrigin: false
      },
      '/testwise/api': {
        target: 'http://backend.example.test:3000',
        changeOrigin: false
      }
    });
    expect(proxy?.['/testwise/api'].rewrite?.('/testwise/api/features')).toBe('/api/features');
  });

  test('routes report paths to their dedicated service before the task API fallback', () => {
    const proxy = createApiProxy(
      'http://backend.example.test:3000',
      '/testwise/',
      'http://backend.example.test:3001'
    );

    expect(Object.keys(proxy ?? {})).toEqual([
      '^/api/reports(?:[/?]|$)',
      '/api',
      '^/testwise/api/reports(?:[/?]|$)',
      '/testwise/api'
    ]);
    expect(proxy?.['^/api/reports(?:[/?]|$)']).toMatchObject({
      target: 'http://backend.example.test:3001',
      changeOrigin: false
    });
    expect(proxy?.['^/testwise/api/reports(?:[/?]|$)']).toMatchObject({
      target: 'http://backend.example.test:3001',
      changeOrigin: false
    });
    expect(proxy?.['^/testwise/api/reports(?:[/?]|$)'].rewrite?.('/testwise/api/reports/report-1')).toBe(
      '/api/reports/report-1'
    );
    expect(proxy?.['/testwise/api']).toMatchObject({
      target: 'http://backend.example.test:3000'
    });

    const rootReportMatcher = new RegExp('^/api/reports(?:[/?]|$)');
    const deployedReportMatcher = new RegExp('^/testwise/api/reports(?:[/?]|$)');
    expect(rootReportMatcher.test('/api/reports')).toBe(true);
    expect(rootReportMatcher.test('/api/reports?software_version=build-1')).toBe(true);
    expect(rootReportMatcher.test('/api/reports/report-1')).toBe(true);
    expect(rootReportMatcher.test('/api/reportsfoo')).toBe(false);
    expect(deployedReportMatcher.test('/testwise/api/reports?limit=20')).toBe(true);
    expect(deployedReportMatcher.test('/testwise/api/reports/report-1')).toBe(true);
    expect(deployedReportMatcher.test('/testwise/api/reportsfoo')).toBe(false);
  });
});
