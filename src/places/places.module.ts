import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { SnapshotBuilderService } from './snapshot-builder.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService, SnapshotBuilderService],
})
export class PlacesModule {}
