import { Module } from '@nestjs/common';
import { DeadlineService } from './deadline.service';
import { RequestService } from './request.service';
import { ResponseService } from './response.service';
import { SubmitterService } from './submitter.service';

/**
 * ماژول ثبت — اصل VI، مرز اول از سه مرز دامنه.
 * `dashboard` و `reports` جداگانه می‌آیند و از راه قرارداد حرف می‌زنند.
 */
@Module({
  providers: [DeadlineService, RequestService, ResponseService, SubmitterService],
  exports: [DeadlineService, RequestService, ResponseService, SubmitterService],
})
export class IntakeModule {}
