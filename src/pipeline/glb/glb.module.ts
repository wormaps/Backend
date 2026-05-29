import { Module } from '@nestjs/common';

import { GlbCompilerService, GlbValidationService, GltfMetadataFactory } from './application';
import { GoogleTilesMergeService } from './application/compiler/google-tiles-merge.service';

@Module({
  providers: [GlbCompilerService, GlbValidationService, GltfMetadataFactory, GoogleTilesMergeService],
  exports: [GlbCompilerService, GlbValidationService],
})
export class GlbModule {}
