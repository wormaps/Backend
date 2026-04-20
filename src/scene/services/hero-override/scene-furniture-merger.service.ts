import { Injectable } from '@nestjs/common';
import {
  LandmarkAnnotationManifest,
  SceneDetail,
} from '../../types/scene.types';
import { mergeByObjectId } from './merge-by-object-id.utils';

@Injectable()
export class SceneFurnitureMergerService {
  mergeStreetFurniture(
    detail: SceneDetail,
    manifest: LandmarkAnnotationManifest,
  ): SceneDetail['streetFurniture'] {
    return mergeByObjectId(
      detail.streetFurniture,
      manifest.streetFurnitureRows.flatMap((row) =>
        row.points.map((point, pointIndex) => ({
          objectId: `${row.id}-${pointIndex + 1}`,
          name: `${row.id}-${pointIndex + 1}`,
          type: row.type,
          location: point,
          principal: row.principal ?? false,
        })),
      ),
    );
  }
}
