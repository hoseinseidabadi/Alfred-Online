import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS به `emitDecoratorMetadata` نیاز دارد و esbuild آن را تولید نمی‌کند،
// پس تبدیل با SWC انجام می‌شود.
export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globals: true,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
