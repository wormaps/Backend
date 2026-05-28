import { Module } from '@nestjs/common';

import { GlbCompilerService } from './application/glb-compiler.service';
import { GlbValidationService } from './application/glb-validation.service';
import { GltfMetadataFactory } from './application/gltf-metadata.factory';

@Module({
  providers: [GlbCompilerService, GlbValidationService, GltfMetadataFactory],
  exports: [GlbCompilerService, GlbValidationService],
})
export class GlbModule {}
