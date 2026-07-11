import type { RuntimeConfig } from '../types';
import { runtimeConfigPath } from './appBasePath';

export const defaultSutTargets: RuntimeConfig['sutTargets'] = [
  {
    id: 'java-sut',
    name: '营销系统 Java SUT',
    product: '高码java',
    scene: '场景',
    version: 'v2.4.1',
    apiBaseUrl: '/api',
    status: 'healthy'
  },
  {
    id: 'python-sut',
    name: '高码 Python 验证环境',
    product: '高码python',
    scene: 'API',
    version: 'v1.8.0',
    apiBaseUrl: '/api',
    status: 'degraded'
  },
  {
    id: 'workflow-sut',
    name: '场景化工作流沙箱',
    product: '合一版本',
    scene: '场景',
    version: 'v3.0.0',
    apiBaseUrl: '/api',
    status: 'healthy'
  }
];

export function resolveRuntimeConfig(input?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl: input?.apiBaseUrl ?? '/api',
    deploymentMode: input?.deploymentMode ?? 'process',
    defaultLanguage: input?.defaultLanguage ?? 'zh',
    enableMockFallback: input?.enableMockFallback ?? true,
    sutTargets: input?.sutTargets?.length ? input.sutTargets : defaultSutTargets,
    auth: input?.auth
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch(runtimeConfigPath(import.meta.env.BASE_URL), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      return resolveRuntimeConfig();
    }

    return resolveRuntimeConfig((await response.json()) as Partial<RuntimeConfig>);
  } catch {
    return resolveRuntimeConfig();
  }
}
