import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { validateProviderApiKeys } from './providers';

const logger = new Logger('bootstrap');

async function bootstrap(): Promise<void> {
  validateProviderApiKeys({ strict: process.env.NODE_ENV === 'production' });
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('WorMap v2 API')
    .setDescription('3D city GLB pipeline — build, cache, and serve GLB scenes from OSM data')
    .setVersion('2.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  await app.listen(port);
  logger.log(`WorMap v2 running at http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

if (import.meta.main) {
  void bootstrap();
}
