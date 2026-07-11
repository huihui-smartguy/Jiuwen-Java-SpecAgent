import { describe, expect, test } from 'vitest';
import { appBasePath, runtimeConfigPath } from './appBasePath';

describe('application base path', () => {
  test('uses the site root when no base path is configured', () => {
    expect(appBasePath()).toBe('/');
  });

  test('normalizes a deployment subpath with leading and trailing slashes', () => {
    expect(appBasePath('testwise')).toBe('/testwise/');
    expect(appBasePath('/testwise')).toBe('/testwise/');
    expect(appBasePath('/testwise/')).toBe('/testwise/');
    expect(runtimeConfigPath('/testwise/')).toBe('/testwise/config/runtime.json');
  });
});
