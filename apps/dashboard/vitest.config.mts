import { defineConfig } from 'vitest/config';

// فاز ۵ (T087، T088، T104) محیط jsdom و پلاگین react را اضافه می‌کند؛
// تا آن زمان فقط آزمون‌های منطقی غیر-DOM اینجا اجرا می‌شوند.
export default defineConfig({
  test: {
    name: 'dashboard',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
