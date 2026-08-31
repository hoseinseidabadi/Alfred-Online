import { defineConfig } from 'vitest/config';

// هر اپ و پکیج پیکربندی خودش را دارد. اسکریپت `test:resilience` در ریشه با فیلتر
// مسیر `tests/resilience` اجرا می‌شود — همان شش آزمون الزامی قانون اساسی.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: ['apps/*/vitest.config.{ts,mts}', 'packages/*/vitest.config.{ts,mts}'],
  },
});
