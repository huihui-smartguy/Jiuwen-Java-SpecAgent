import { appBasePath } from './appBasePath';

interface ProxyRule {
  target: string;
  changeOrigin: boolean;
  rewrite?: (path: string) => string;
}

export function createApiProxy(
  target = process.env.TESTWISE_API_PROXY_TARGET,
  basePath = process.env.VITE_BASE_PATH,
  reportTarget = process.env.TESTWISE_REPORT_API_PROXY_TARGET
) {
  if (!target) {
    return undefined;
  }

  const options = {
    target,
    changeOrigin: false
  };
  const proxy: Record<string, ProxyRule> = {};

  if (reportTarget) {
    proxy['/api/reports'] = {
      target: reportTarget,
      changeOrigin: false
    };
  }

  proxy['/api'] = {
    ...options
  };
  const deploymentApiPath = `${appBasePath(basePath)}api`;

  if (deploymentApiPath !== '/api') {
    if (reportTarget) {
      const deploymentReportPath = `${deploymentApiPath}/reports`;
      proxy[deploymentReportPath] = {
        target: reportTarget,
        changeOrigin: false,
        rewrite: (path) => path.replace(new RegExp(`^${deploymentReportPath}`), '/api/reports')
      };
    }
    proxy[deploymentApiPath] = {
      ...options,
      rewrite: (path) => path.replace(new RegExp(`^${deploymentApiPath}`), '/api')
    };
  }

  return proxy;
}
