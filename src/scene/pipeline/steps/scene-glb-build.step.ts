import { Injectable } from '@nestjs/common';
import { GlbBuilderService } from '../../../assets/glb-builder.service';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';

@Injectable()
export class SceneGlbBuildStep {
  constructor(
    private readonly glbBuilderService: GlbBuilderService,
  ) {}

  execute(meta: SceneMeta, detail: SceneDetail): Promise<string> {
    return this.glbBuilderService.build(meta, detail);
  }
}
