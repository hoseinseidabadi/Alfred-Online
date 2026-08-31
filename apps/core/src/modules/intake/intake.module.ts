import { Module } from '@nestjs/common';
import { DeadlineService } from './deadline.service';
import { RequestService } from './request.service';
import { SubmitterService } from './submitter.service';

/**
 * ماژول ثبت — اصل VI، مرز اول از سه مرز دامنه.
 * `dashboard` و `reports` جداگانه می‌آیند و از راه قرارداد حرف می‌زنند.
 */
@Module({
  providers: [DeadlineService, RequestService, SubmitterService],
  exports: [DeadlineService, RequestService, SubmitterService],
})
export class IntakeModule {}
