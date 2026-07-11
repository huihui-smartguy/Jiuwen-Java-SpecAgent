export function appBasePath(value?: string): string {
  const trimmed = value?.trim() ?? '';

  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

export function runtimeConfigPath(basePath?: string): string {
  return `${appBasePath(basePath)}config/runtime.json`;
}
