import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('WorMap Backend API')
    .setDescription(
      'WorMap 백엔드 API 문서입니다. 모든 응답은 공통 envelope를 사용합니다.',
    )
    .setVersion('1.0.0-mvp')
    .addServer('http://localhost:3000', 'Local')
    .addTag('health', '서비스 상태 확인')
    .addTag('places', '장소 registry / package / snapshot')
    .addTag('external-places', 'Google Places / Overpass / Open-Meteo 연동')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: 'WorMap API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });
}
