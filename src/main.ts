import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { HttpAppModule } from './http/http-app.module';
import { createWorMapMvpApp } from './core/create-wormap-app';
import { validateProviderApiKeys } from './providers/providers.module';

const logger = new Logger('bootstrap');

function validateEnvForRuntime(): void {
  const env = process.env.NODE_ENV ?? 'development';
  const strict = env === 'production';
  validateProviderApiKeys({ strict });
}

async function bootstrap(): Promise<void> {
  validateEnvForRuntime();
  const app = await NestFactory.create(HttpAppModule);
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  await app.listen(port);
  logger.log(`WorMap v2 server running at http://localhost:${port}`);
  logger.log(`API docs at http://localhost:${port}/api`);
}

if (import.meta.main) {
  void bootstrap();
}

export { createWorMapMvpApp };
