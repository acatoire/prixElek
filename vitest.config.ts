import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Fail CI if any threshold is below 100%
      thresholds: {
        lines: 100,
        branches: 90,
        functions: 100,
        statements: 100,
      },
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/types/**',          // interfaces & re-exports only — no runtime branches
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'eslint.config.js',
        'prettier.config.js',
        'tools/**',
        'coverage/**',
        'dist/**',
      ],
    },
  },
});

