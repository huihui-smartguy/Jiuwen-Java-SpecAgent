import { describe, expect, test } from 'vitest';
import { resolveRuntimeConfig } from './runtime';

describe('runtime config', () => {
  test('keeps the same artifact deployable across process and container modes', () => {
    const config = resolveRuntimeConfig({
      apiBaseUrl: '/gateway',
      deploymentMode: 'container',
      defaultLanguage: 'en',
      sutTargets: [
        {
          id: 'java-sut',
          name: 'Java SUT',
          product: '高码java',
          scene: '场景',
          version: 'v2.4.1',
          apiBaseUrl: '/gateway',
          status: 'healthy'
        }
      ]
    });

    expect(config.apiBaseUrl).toBe('/gateway');
    expect(config.deploymentMode).toBe('container');
    expect(config.defaultLanguage).toBe('en');
    expect(config.sutTargets[0].product).toBe('高码java');
  });

  test('falls back to process deployment defaults when runtime config is absent', () => {
    const config = resolveRuntimeConfig(undefined);

    expect(config.apiBaseUrl).toBe('/api');
    expect(config.deploymentMode).toBe('process');
    expect(config.defaultLanguage).toBe('zh');
    expect(config.sutTargets.length).toBeGreaterThan(0);
  });

  test('preserves optional enterprise SSO runtime configuration', () => {
    const config = resolveRuntimeConfig({
      auth: {
        profileUrl: '/identity/profile',
        loginUrl: '/identity/login',
        registerUrl: '/identity/register',
        logoutUrl: '/identity/logout'
      }
    });

    expect(config.auth?.profileUrl).toBe('/identity/profile');
    expect(config.auth?.registerUrl).toBe('/identity/register');
  });
});
