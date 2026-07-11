import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createApiProxy } from './src/config/viteProxy';

const apiProxy = createApiProxy();

export default defineConfig({
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
