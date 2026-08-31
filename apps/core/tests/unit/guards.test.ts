import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BridgeKeyGuard, timingSafeEqual } from '../../src/bridge/bridge-key.guard';
import { ROLES_KEY, RolesGuard } from '../../src/auth/roles.guard';
import { Role, canWrite } from '../../src/auth/roles';

/** حداقلِ لازم از `ExecutionContext` برای این دو نگهبان. */
const contextWith = (request: Record<string, unknown>, metadata?: Role[]): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => {
      const handler = (): void => {};
      if (metadata !== undefined) Reflect.defineMetadata(ROLES_KEY, metadata, handler);
      return handler;
    },
    getClass: () => class {},
  }) as unknown as ExecutionContext;

const bridgeRequest = (key?: string) => ({
  header: (name: string) => (name === 'x-bridge-key' ? key : undefined),
});

describe('BridgeKeyGuard — T020', () => {
  const guard = new BridgeKeyGuard();
  const original = process.env.BRIDGE_KEY;

  beforeEach(() => {
    process.env.BRIDGE_KEY = 'shared-bridge-secret';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.BRIDGE_KEY;
    else process.env.BRIDGE_KEY = original;
  });

  it('کلید درست را می‌پذیرد', () => {
    expect(guard.canActivate(contextWith(bridgeRequest('shared-bridge-secret')))).toBe(true);
  });

  it('کلید اشتباه را رد می‌کند', () => {
    expect(guard.canActivate(contextWith(bridgeRequest('wrong')))).toBe(false);
  });

  it('نبود هدر را رد می‌کند', () => {
    expect(guard.canActivate(contextWith(bridgeRequest()))).toBe(false);
  });

  it('پیشوند کلید درست را نمی‌پذیرد', () => {
    expect(guard.canActivate(contextWith(bridgeRequest('shared')))).toBe(false);
  });

  it('وقتی BRIDGE_KEY تنظیم نشده، همه‌چیز را رد می‌کند نه اینکه باز بگذارد', () => {
    // پیکربندی ناقص MUST به «بسته» ختم شود، نه «باز». اگر برعکس بود، یک
    // استقرارِ بدون‌راز پل را برای همه باز می‌گذاشت.
    delete process.env.BRIDGE_KEY;
    expect(guard.canActivate(contextWith(bridgeRequest('anything')))).toBe(false);
  });
});

describe('timingSafeEqual', () => {
  it('طول‌های نابرابر را بدون خطا رد می‌کند', () => {
    // node:crypto.timingSafeEqual روی طول متفاوت پرتاب می‌کند؛ اگر این
    // بررسی نبود، یک هدر با طول اشتباه به‌جای 401 به خطای 500 می‌رسید.
    expect(() => timingSafeEqual('short', 'much-longer-value')).not.toThrow();
    expect(timingSafeEqual('short', 'much-longer-value')).toBe(false);
  });

  it('برابرها را می‌پذیرد', () => {
    expect(timingSafeEqual('same-value', 'same-value')).toBe(true);
  });
});

describe('RolesGuard — T019', () => {
  const guard = new RolesGuard(new Reflector());

  it('بدون نشست رد می‌کند', () => {
    expect(guard.canActivate(contextWith({}))).toBe(false);
  });

  it('پیش‌فرض فقط product است، نه همه', () => {
    // نقطهٔ تماسی که کسی یادش رفته @Roles بزند MUST برای viewer بسته باشد.
    expect(guard.canActivate(contextWith({ user: { role: Role.product } }))).toBe(true);
    expect(guard.canActivate(contextWith({ user: { role: Role.viewer } }))).toBe(false);
  });

  it('وقتی صریحاً viewer مجاز شده، بازش می‌کند', () => {
    expect(
      guard.canActivate(contextWith({ user: { role: Role.viewer } }, [Role.product, Role.viewer])),
    ).toBe(true);
  });
});

describe('نقش‌ها', () => {
  it('مدیران فقط می‌خوانند', () => {
    expect(canWrite(Role.product)).toBe(true);
    expect(canWrite(Role.viewer)).toBe(false);
  });
});
