/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { D1Migration } from '@cloudflare/vitest-pool-workers';
import type { Env as WorkerEnv } from '../src/env';

// `env` در `cloudflare:test` از فضای نام سراسری `Cloudflare` می‌آید.
// این ادغام، همان bindings تعریف‌شده در wrangler.toml را به آن می‌دهد.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      /** جای‌نگهدار تا interface خالی نباشد؛ اعضای واقعی از WorkerEnv می‌آیند. */
      readonly __brand?: 'alfred-online-edge';
    }
  }
}

declare module 'vitest' {
  interface ProvidedContext {
    /** مهاجرت‌های D1، از `vitest.config.ts` خوانده و تزریق می‌شوند. */
    d1Migrations: D1Migration[];
  }
}

export {};
