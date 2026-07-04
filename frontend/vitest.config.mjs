import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  define: {
    'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify('/api'),
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    include: [
      'tests/unit/**/*.{test,spec}.{js,jsx}',
      'app/**/*.{test,spec}.{js,jsx}',
      'components/**/*.{test,spec}.{js,jsx}',
    ],
    exclude: [
      ...configDefaults.exclude,
      '**/.next/**',
      'tests/*.spec.js',
    ],
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
});
