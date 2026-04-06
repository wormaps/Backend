import type { Coordinate } from '../../places/types/place.types';
import type {
  SceneMeta,
  SceneSignageCluster,
} from '../../scene/types/scene.types';
import type { AccentTone } from './glb-material-factory';
import type { GeometryBuffers } from './road-mesh.builder';
import { createEmptyGeometry } from './road-mesh.builder';
import {
  computeBounds,
  normalizeLocalRing,
  toLocalPoint,
  toLocalRing,
} from './building-mesh-utils';
import { pushBox, pushQuad } from './building-mesh.geometry-primitives';
import { buildFacadeFrame } from './building-mesh.facade-frame.utils';
import {
  pushCanopyBand,
  pushTopBillboardZone,
} from './building-mesh.facade-band.utils';
import { resolveAccentTone } from './building-mesh.tone.utils';
import { insetRing } from './building-mesh.shell.builder';

export function createHeroCanopyGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    if (!building.visualRole || building.visualRole === 'generic') {
      continue;
    }
    const ring = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (ring.length < 3) {
      continue;
    }
    const canopyEdges = building.podiumSpec?.canopyEdges ?? [];
    for (const edgeIndex of canopyEdges) {
      const frame = buildFacadeFrame(
        ring,
        edgeIndex % ring.length,
        Math.max(
          4.2,
          building.podiumSpec?.levels ? building.podiumSpec.levels * 3.6 : 4.2,
        ),
      );
      if (!frame) {
        continue;
      }
      pushCanopyBand(geometry, frame, 4.2);
    }
  }

  return geometry;
}

export function createHeroRoofUnitGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const roofUnits = building.roofSpec?.roofUnits ?? 0;
    if (
      !building.visualRole ||
      building.visualRole === 'generic' ||
      roofUnits <= 0
    ) {
      continue;
    }
    const ring = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (ring.length < 3) {
      continue;
    }
    const inset = insetRing(ring, 0.18);
    const bounds = computeBounds(inset.length >= 3 ? inset : ring);
    const columns = Math.max(1, Math.ceil(Math.sqrt(roofUnits)));
    for (let index = 0; index < roofUnits; index += 1) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const centerX = bounds.minX + ((col + 1) / (columns + 1)) * bounds.width;
      const centerZ =
        bounds.minZ +
        ((row + 1) / (Math.ceil(roofUnits / columns) + 1)) * bounds.depth;
      pushBox(
        geometry,
        [centerX - 0.7, building.heightMeters + 0.2, centerZ - 0.5],
        [centerX + 0.7, building.heightMeters + 1.6, centerZ + 0.5],
      );
    }
  }

  return geometry;
}

export function createHeroBillboardPlaneGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const faces = building.signageSpec?.billboardFaces ?? [];
    if (
      !building.visualRole ||
      building.visualRole === 'generic' ||
      faces.length === 0
    ) {
      continue;
    }
    const ring = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (ring.length < 3) {
      continue;
    }
    for (const edgeIndex of faces) {
      const frame = buildFacadeFrame(
        ring,
        edgeIndex % ring.length,
        Math.max(8, building.heightMeters * 0.78),
      );
      if (!frame) {
        continue;
      }
      pushTopBillboardZone(geometry, frame);
    }
  }

  return geometry;
}

export function createBillboardsGeometry(
  origin: Coordinate,
  clusters: SceneSignageCluster[],
  tone: AccentTone,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const cluster of clusters) {
    if (resolveAccentTone(cluster.palette) !== tone) {
      continue;
    }
    const anchor = toLocalPoint(origin, cluster.anchor);
    const poleWidth = 0.08;
    pushBox(
      geometry,
      [anchor[0] - poleWidth, 0, anchor[2] - poleWidth],
      [anchor[0] + poleWidth, 4.6, anchor[2] + poleWidth],
    );
    pushQuad(
      geometry,
      [anchor[0] - cluster.widthMeters / 2, 4.6, anchor[2] + 0.24],
      [anchor[0] + cluster.widthMeters / 2, 4.6, anchor[2] + 0.24],
      [
        anchor[0] + cluster.widthMeters / 2,
        4.6 + cluster.heightMeters,
        anchor[2] + 0.24,
      ],
      [
        anchor[0] - cluster.widthMeters / 2,
        4.6 + cluster.heightMeters,
        anchor[2] + 0.24,
      ],
    );
  }

  return geometry;
}

export function createLandmarkExtrasGeometry(
  origin: Coordinate,
  anchors: SceneMeta['landmarkAnchors'],
  clusters: SceneSignageCluster[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const anchor of anchors.slice(0, 8)) {
    const center = toLocalPoint(origin, anchor.location);
    const size = anchor.kind === 'CROSSING' ? 1.2 : 0.8;
    pushBox(
      geometry,
      [center[0] - size, 0.02, center[2] - size],
      [center[0] + size, 0.18, center[2] + size],
    );
  }

  for (const cluster of clusters.slice(0, 6)) {
    const anchor = toLocalPoint(origin, cluster.anchor);
    pushBox(
      geometry,
      [anchor[0] - 0.2, 6.2, anchor[2] - 0.2],
      [anchor[0] + 0.2, 7.2, anchor[2] + 0.2],
    );
  }

  return geometry;
}
