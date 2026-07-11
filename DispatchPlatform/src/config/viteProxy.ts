import { appBasePath } from './appBasePath';

interface ProxyRule {
  target: string;
  changeOrigin: boolean;
  rewrite?: (path: string) => string;
}

export function createApiProxy(
  target = process.env.TESTWISE_API_PROXY_TARGET,
  basePath = process.env.VITE_BASE_PATH
) {
  if (!target) {
    return undefined;
  }

  const options = {
    target,
    changeOrigin: false
  };
  const proxy: Record<string, ProxyRule> = {
    '/api': {
      ...options
    }
  };
  const deploymentApiPath = `${appBasePath(basePath)}api`;

  if (deploymentApiPath !== '/api') {
    proxy[deploymentApiPath] = {
      ...options,
      rewrite: (path) => path.replace(new RegExp(`^${deploymentApiPath}`), '/api')
    };
  }

  return proxy;
}
