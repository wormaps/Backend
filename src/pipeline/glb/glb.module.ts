import { Module } from '@nestjs/common';

import { GlbCompilerService, GlbValidationService, GltfMetadataFactory } from './application';

@Module({
  providers: [GlbCompilerService, GlbValidationService, GltfMetadataFactory],
  exports: [GlbCompilerService, GlbValidationService],
})
export class GlbModule {}
