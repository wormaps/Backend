import { Module } from '@nestjs/common';

import { GlbCompilerService } from './application/glb-compiler.service';
import { GlbValidationService } from './application/glb-validation.service';
import { GltfMetadataFactory } from './application/gltf-metadata.factory';

@Module({
  providers: [GlbCompilerService, GlbValidationService, GltfMetadataFactory],
  exports: [GlbCompilerService, GlbValidationService],
})
export class GlbModule {}

// Legacy export kept temporarily until AppModule fully migrates to Nest DI.
const legacyMetadataFactory = new GltfMetadataFactory();
export const glbModule = {
  name: 'glb',
  services: {
    glbCompiler: new GlbCompilerService(legacyMetadataFactory),
    glbValidation: new GlbValidationService(),
  },
} as const;
