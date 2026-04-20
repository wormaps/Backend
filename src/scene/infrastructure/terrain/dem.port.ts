import type { Coordinate } from '../../../places/types/place.types';
import type { TerrainSample } from '../../types/scene.types';

export abstract class IDemPort {
  abstract fetchElevations(points: Coordinate[]): Promise<TerrainSample[]>;
}
