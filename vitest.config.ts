import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest config — Stage 1 unit-test surface (ADR-0003).
// Mirrors the `@/*` alias from tsconfig.json so test files can import like the app.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
