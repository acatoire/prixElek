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
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tools/lib/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/adapters/**', 'src/services/**', 'src/hooks/**', 'src/components/**', 'src/utils/**', 'src/App.tsx', 'tools/lib/**'],
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 92,
        statements: 95,
      },
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/types/**',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'eslint.config.js',
        'prettier.config.js',
        // CLI entry points — not unit-testable, covered by integration
        'tools/add-to-catalogue.ts',
        'tools/probe-materielelectrique.ts',
        'tools/scrape-materielelectrique.ts',
        'coverage/**',
        'dist/**',
      ],
    },
  },
});

