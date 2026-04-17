import { Module } from '@nestjs/common';
import { GlbBuilderService } from '../../assets/glb-builder.service';
import { GlbBuildRunner } from '../../assets/internal/glb-build';
import { SceneVisionModule } from './scene-vision.module';

@Module({
  imports: [SceneVisionModule],
  providers: [GlbBuilderService, GlbBuildRunner],
  exports: [GlbBuilderService, GlbBuildRunner],
})
export class SceneAssetsModule {}
