import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PlacesModule } from './places/places.module';

@Module({
  imports: [HealthModule, PlacesModule],
})
export class AppModule {}
