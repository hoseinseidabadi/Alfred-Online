import { timingSafeEqual as constantTimeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { BRIDGE_KEY_HEADER } from '@alfred-online/contracts';
import type { Request } from 'express';

/**
 * نگهبان پل — T020، R-06.
 *
 * تمام نقاط تماس `/bridge/*` فقط از سمت **لبه** صدا زده می‌شوند (اصل III).
 * هر تماس بدون هدر `X-Bridge-Key` معتبر، `401` می‌گیرد.
 *
 * راز مشترک از `.env` محلی یا Secret Store می‌آید، هرگز از ریپو.
 */
@Injectable()
export class BridgeKeyGuard implements CanActivate {
  private readonly logger = new Logger(BridgeKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.BRIDGE_KEY;

    if (expected === undefined || expected.length === 0) {
      // خرابی پیکربندی ماست، نه حملهٔ کسی. اگر لاگ نشود، به‌صورت «پل کار
      // نمی‌کند» ظاهر می‌شود و دنبال علتش در جای اشتباه می‌گردیم.
      this.logger.error('BRIDGE_KEY تنظیم نشده است — همهٔ تماس‌های پل رد می‌شوند');
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const presented = request.header(BRIDGE_KEY_HEADER);
    if (presented === undefined || presented.length === 0) return false;

    return timingSafeEqual(presented, expected);
  }
}

/**
 * مقایسهٔ مقاوم به حملهٔ زمانی.
 *
 * برخلاف لبه، اینجا `crypto.subtle.timingSafeEqual` در دسترس نیست، پس
 * `node:crypto` استفاده می‌شود. `===` کافی نیست: در اولین بایت متفاوت
 * برمی‌گردد و طول زمان پاسخ، راز را بایت به بایت لو می‌دهد.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return constantTimeEqual(left, right);
}
