import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';

/**
 * مرزهای ماژول از روز اول (اصل VI): intake / dashboard / reports،
 * به‌علاوهٔ دو ماژول قرارداد: bridge و triage.
 * ماژول‌های دامنه به‌ترتیب فازها اضافه می‌شوند.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CommonModule],
})
export class AppModule {}
