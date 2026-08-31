import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';

/**
 * زیرساخت مشترک همهٔ ماژول‌ها.
 *
 * `@Global` است چون هر سه ماژول دامنه (intake / dashboard / reports) به اتصال
 * پایگاه داده و نویسندهٔ سابقه نیاز دارند، و تکرار import در هر کدام فقط نویز
 * می‌سازد. مرزهای ماژول اصل VI دربارهٔ **دامنه** است، نه زیرساخت.
 */
@Global()
@Module({
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class CommonModule {}
