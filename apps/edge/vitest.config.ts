import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// از نسخهٔ 0.22 پکیج، `defineWorkersConfig` حذف شده و جایش پلاگین
// `cloudflareTest` آمده. آزمون‌ها داخل زمان اجرای واقعی Workers اجرا می‌شوند.
export default defineConfig({
  test: { name: 'edge', include: ['tests/**/*.test.ts'] },
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
});
