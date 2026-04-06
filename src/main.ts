import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor';
import { setupSwagger } from './docs/setup';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  setupSwagger(app);

  const port = process.env.PORT ?? 8080;
  await app.listen(port);

  Logger.log(`WorMap BE listening on port ${port}`, 'Bootstrap');
}
void bootstrap();
