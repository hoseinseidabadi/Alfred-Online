import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/**
 * مرزهای ماژول از روز اول (اصل VI): intake / dashboard / reports،
 * به‌علاوهٔ دو ماژول قرارداد: bridge و triage.
 * ماژول‌ها به‌ترتیب فازها اضافه می‌شوند.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
