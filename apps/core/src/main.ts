import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);
  // `0.0.0.0` صریح: در کانتینر، اتصال به لوپ‌بک از بیرون دیده نمی‌شود و
  // health check شکست می‌خورد. اکسپرس پیش‌فرضش همین است، ولی به پیش‌فرضِ
  // یک کتابخانه در مسیر استقرار تکیه نمی‌کنیم.
  await app.listen(port, '0.0.0.0');
  console.log(`هستهٔ Alfred-Online روی پورت ${port} بالا آمد`);
}

void bootstrap();
