import type {
  SceneMeta,
  SpatialFrameManifest,
  TerrainSnapshotPayload,
} from '../../types/scene.types';
import {
  buildSpatialVerificationSamples,
  distanceMeters,
  resolveMetersPerDegree,
} from '../../utils/scene-spatial-frame.utils';
import { hashValue, roundMetric } from './twin-hash.utils';

export function buildSpatialFrame(
  sceneId: string,
  meta: SceneMeta,
  generatedAt: string,
  terrainProfile: TerrainSnapshotPayload,
): SpatialFrameManifest {
  const { metersPerLat, metersPerLng } = resolveMetersPerDegree(meta.origin);
  const width = distanceMeters(
    { lat: meta.origin.lat, lng: meta.bounds.southWest.lng },
    { lat: meta.origin.lat, lng: meta.bounds.northEast.lng },
  );
  const depth = distanceMeters(
    { lat: meta.bounds.southWest.lat, lng: meta.origin.lng },
    { lat: meta.bounds.northEast.lat, lng: meta.origin.lng },
  );
  const verification = buildSpatialVerificationSamples(meta.origin, [
    {
      label: 'northEast',
      point: meta.bounds.northEast,
    },
    {
      label: 'southWest',
      point: meta.bounds.southWest,
    },
    {
      label: 'origin',
      point: meta.origin,
    },
  ]);

  return {
    frameId: `frame-${hashValue(sceneId).slice(0, 12)}`,
    sceneId,
    generatedAt,
    geodeticCrs: 'WGS84',
    localFrame: 'ENU',
    axis: 'Z_UP',
    unit: 'meter',
    heightReference: terrainProfile.heightReference,
    anchor: meta.origin,
    bounds: {
      northEast: meta.bounds.northEast,
      southWest: meta.bounds.southWest,
    },
    extentMeters: {
      width: roundMetric(width),
      depth: roundMetric(depth),
      radius: meta.bounds.radiusM,
    },
    transform: {
      metersPerLat: roundMetric(metersPerLat),
      metersPerLng: roundMetric(metersPerLng),
      localAxes: {
        east: [1, 0, 0],
        north: [0, 0, -1],
        up: [0, 1, 0],
      },
    },
    terrain: {
      mode: terrainProfile.mode,
      source: terrainProfile.source,
      hasElevationModel: terrainProfile.hasElevationModel,
      baseHeightMeters: terrainProfile.baseHeightMeters,
      sampleCount: terrainProfile.sampleCount,
      sourcePath: terrainProfile.sourcePath,
      notes: terrainProfile.notes,
    },
    verification,
    delivery: {
      glbAxisConvention: 'Y_UP_DERIVED',
      transformRequired: true,
    },
  };
}
