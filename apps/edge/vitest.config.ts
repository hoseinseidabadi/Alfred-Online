import { resolve } from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * پیکربندی آزمون لبه.
 *
 * از نسخهٔ 0.22 پکیج، `defineWorkersConfig` حذف شده و جایش پلاگین
 * `cloudflareTest` آمده. آزمون‌ها داخل زمان اجرای **واقعی** Workers اجرا
 * می‌شوند، نه شبیه‌سازی — همان چیزی که Technical Context برنامه الزام کرده.
 *
 * مهاجرت‌های D1 اینجا (در Node) خوانده می‌شوند و از راه `provide` به آزمون‌ها
 * می‌رسند. عمداً **همان فایل مهاجرتِ تولید** خوانده می‌شود، نه یک شمای دستیِ
 * موازی — وگرنه آزمون‌ها روی جدولی اجرا می‌شوند که با تولید فرق دارد و دقیقاً
 * همان جایی که باید بگیرند، نمی‌گیرند.
 */
const migrations = await readD1Migrations(resolve(import.meta.dirname, 'migrations'));

export default defineConfig({
  test: {
    name: 'edge',
    include: ['tests/**/*.test.ts'],
    provide: { d1Migrations: migrations },
  },
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
});
