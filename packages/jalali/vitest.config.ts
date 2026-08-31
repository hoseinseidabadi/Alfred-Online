import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'jalali', environment: 'node', include: ['tests/**/*.test.ts'] },
});
