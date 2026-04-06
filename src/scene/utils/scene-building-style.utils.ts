import { Coordinate } from '../../places/types/place.types';
import {
  BuildingStyleInput,
  BuildingStyleProfile,
  BuildingStyleResolverService,
} from '../services/building-style-resolver.service';

const buildingStyleResolver = new BuildingStyleResolverService();

export type { BuildingStyleInput, BuildingStyleProfile };

export function resolveBuildingStyle(input: BuildingStyleInput): BuildingStyleProfile {
  return buildingStyleResolver.resolveBuildingStyle(input);
}

export function estimateFacadeEdgeIndex(ring: Coordinate[]): number | null {
  return buildingStyleResolver.estimateFacadeEdgeIndex(ring);
}

export function resolveMaterialClass(input: BuildingStyleInput) {
  return buildingStyleResolver.resolveMaterialClass(input);
}

export function resolveRoofType(input: BuildingStyleInput) {
  return buildingStyleResolver.resolveRoofType(input);
}

export function normalizeColor(value: string): string {
  return buildingStyleResolver.normalizeColor(value);
}
