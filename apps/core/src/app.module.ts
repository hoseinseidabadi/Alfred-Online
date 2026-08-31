import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BridgeModule } from './bridge/bridge.module';
import { CommonModule } from './common/common.module';
import { IntakeModule } from './modules/intake/intake.module';

/**
 * مرزهای ماژول از روز اول (اصل VI): intake / dashboard / reports،
 * به‌علاوهٔ دو ماژول قرارداد: bridge و triage.
 * `dashboard`، `reports` و `triage` در فازهای بعد اضافه می‌شوند.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CommonModule, IntakeModule, BridgeModule],
})
export class AppModule {}
