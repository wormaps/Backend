import { Module } from '@nestjs/common';

import { GlbCompilerService } from './application';
import { GlbValidationService } from './application';
import { GltfMetadataFactory } from './application/gltf-metadata.factory';

@Module({
  providers: [GlbCompilerService, GlbValidationService, GltfMetadataFactory],
  exports: [GlbCompilerService, GlbValidationService],
})
export class GlbModule {}
