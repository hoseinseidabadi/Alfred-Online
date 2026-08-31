import { Module } from '@nestjs/common';
import { IntakeModule } from '../modules/intake/intake.module';
import { BridgeController } from './bridge.controller';
import { BridgeHealthService } from './bridge-health.service';

@Module({
  imports: [IntakeModule],
  controllers: [BridgeController],
  providers: [BridgeHealthService],
  exports: [BridgeHealthService],
})
export class BridgeModule {}
