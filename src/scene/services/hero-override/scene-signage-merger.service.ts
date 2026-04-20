import { Injectable } from '@nestjs/common';
import {
  LandmarkAnnotationManifest,
  SceneDetail,
} from '../../types/scene.types';
import { mergeByObjectId } from './merge-by-object-id.utils';

@Injectable()
export class SceneSignageMergerService {
  mergeSignageClusters(
    detail: SceneDetail,
    manifest: LandmarkAnnotationManifest,
  ): SceneDetail['signageClusters'] {
    return mergeByObjectId(
      detail.signageClusters,
      manifest.signageClusters.map((cluster) => ({
        objectId: cluster.id,
        anchor: cluster.anchor,
        panelCount: cluster.panelCount,
        palette: cluster.palette,
        emissiveStrength: cluster.emissiveStrength,
        widthMeters: cluster.widthMeters,
        heightMeters: cluster.heightMeters,
      })),
    );
  }
}
