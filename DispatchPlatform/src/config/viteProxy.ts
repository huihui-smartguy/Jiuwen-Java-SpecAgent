export function createApiProxy(target = process.env.TESTWISE_API_PROXY_TARGET) {
  if (!target) {
    return undefined;
  }

  return {
    '/api': {
      target,
      changeOrigin: false
    }
  };
}
