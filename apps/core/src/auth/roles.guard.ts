import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role, type SessionUser } from './roles';

export const ROLES_KEY = 'alfred:roles';

/** نقش‌های مجاز یک نقطهٔ تماس. بدون این دکوریتور، فقط `product` مجاز است. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * نگهبان نقش — T019.
 *
 * **پیش‌فرض بستن است، نه باز کردن.** نقطهٔ تماسی که دکوریتور `@Roles` ندارد
 * فقط برای `product` باز است. اگر پیش‌فرض برعکس بود، هر نقطهٔ تماس تازه‌ای که
 * کسی یادش می‌رفت علامت بزند، برای `viewer` هم باز می‌شد — و اصل «مدیران فقط
 * خواندن» بی‌سروصدا نقض می‌گشت.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [Role.product];

    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const user = request.user;
    if (user === undefined) return false;

    return allowed.includes(user.role);
  }
}
