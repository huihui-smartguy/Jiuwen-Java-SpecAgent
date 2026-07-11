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
});
