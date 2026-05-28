import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { validateProviderApiKeys } from './providers';

const logger = new Logger('bootstrap');

async function bootstrap(): Promise<void> {
  validateProviderApiKeys({ strict: process.env.NODE_ENV === 'production' });
  const app = await NestFactory.create(AppModule);
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  await app.listen(port);
  logger.log(`WorMap v2 running at http://localhost:${port}`);
  logger.log(`API docs at http://localhost:${port}/api`);
}

if (import.meta.main) {
  void bootstrap();
}
