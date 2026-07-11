import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createApiProxy } from './src/config/viteProxy';
import { appBasePath } from './src/config/appBasePath';

const apiProxy = createApiProxy();

export default defineConfig({
  base: appBasePath(process.env.VITE_BASE_PATH),
  plugins: [react()],
  server: {
    proxy: apiProxy
  },
  preview: {
    proxy: apiProxy
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts'
  }
});
