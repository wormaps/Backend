import { Injectable, Logger } from '@nestjs/common';

import type { SceneScope } from '../../shared/contracts';

type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export type GooglePhotorealTile = {
  bytes: Uint8Array;
  transform: Mat4;
  geometricError: number;
  uri: string;
};

type FetchPhotorealTilesInput = {
  scope: SceneScope;
  maxGeometricError: number;
  maxTiles?: number;
  maxDepth?: number;
};

type TileNode = {
  boundingVolume?: { box?: number[] };
  geometricError?: number;
  refine?: 'ADD' | 'REPLACE';
  transform?: number[];
  content?: { uri?: string; url?: string };
  children?: TileNode[];
};

type Tileset = {
  root: TileNode;
};

type TileCandidate = {
  uri: string;
  transform: Mat4;
  geometricError: number;
};

const EARTH_RADIUS_M = 6_371_000;
const IDENTITY: Mat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

@Injectable()
export class Google3dTilesAdapter {
  private readonly logger = new Logger(Google3dTilesAdapter.name);
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_3D_TILES_API_KEY ?? '';
  private readonly rootUrl = process.env.GOOGLE_3D_TILES_ROOT_URL ?? '';

  async fetchPhotorealTiles(input: FetchPhotorealTilesInput): Promise<GooglePhotorealTile[]> {
    const rootUrl = this.resolveRootUrl();
    if (!rootUrl) return [];

    const candidates: TileCandidate[] = [];
    const maxDepth = input.maxDepth ?? 18;

    const visitedTilesets = new Set<string>();
    const visit = async (node: TileNode, parentTransform: Mat4, depth: number, baseUrl: string): Promise<void> => {
      if (depth > maxDepth) return;

      const local = toMat4(node.transform);
      const worldTransform = multiplyMat4(parentTransform, local);
      if (!intersectsScope(node.boundingVolume?.box, worldTransform, input.scope)) return;

      const hasChildren = (node.children?.length ?? 0) > 0;
      const geometricError = node.geometricError ?? 0;
      const contentUri = node.content?.uri ?? node.content?.url;
      const shouldStop = geometricError <= input.maxGeometricError || !hasChildren;

      if (contentUri && shouldStop && isGlbUri(contentUri)) {
        candidates.push({
          uri: new URL(contentUri, baseUrl).toString(),
          transform: worldTransform,
          geometricError,
        });
      }

      if (contentUri && isTilesetUri(contentUri) && depth < maxDepth) {
        const nestedTilesetUrl = new URL(contentUri, baseUrl).toString();
        if (!visitedTilesets.has(nestedTilesetUrl)) {
          visitedTilesets.add(nestedTilesetUrl);
          const nested = await this.fetchTileset(nestedTilesetUrl);
          await visit(nested.root, worldTransform, depth + 1, nestedTilesetUrl);
        }
      }

      for (const child of node.children ?? []) {
        await visit(child, worldTransform, depth + 1, baseUrl);
      }
    };

    const rootTileset = await this.fetchTileset(rootUrl);
    visitedTilesets.add(rootUrl);
    await visit(rootTileset.root, IDENTITY, 0, rootUrl);

    const maxTiles = input.maxTiles ?? 96;
    const selected = candidates
      .sort((a, b) => a.geometricError - b.geometricError)
      .slice(0, maxTiles);

    const tiles = await Promise.all(
      selected.map(async (candidate): Promise<GooglePhotorealTile | undefined> => {
        const response = await fetch(candidate.uri);
        if (!response.ok) {
          this.logger.warn(`Google tile fetch failed: ${response.status} ${response.statusText} uri=${candidate.uri}`);
          return undefined;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return {
          bytes,
          transform: candidate.transform,
          geometricError: candidate.geometricError,
          uri: candidate.uri,
        };
      }),
    );

    const filtered = tiles.filter((tile): tile is GooglePhotorealTile => tile !== undefined);
    this.logger.log(`Google 3D Tiles fetched: selected=${selected.length} ok=${filtered.length}`);
    return filtered;
  }

  private resolveRootUrl(): string {
    if (this.rootUrl) return this.rootUrl;
    if (!this.apiKey) return '';
    return `https://tile.googleapis.com/v1/3dtiles/root.json?key=${this.apiKey}`;
  }

  private async fetchTileset(url: string): Promise<Tileset> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google 3D Tiles tileset fetch failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as Tileset;
  }
}

function isTilesetUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return lower.endsWith('.json') || lower.includes('tileset');
}

function isGlbUri(uri: string): boolean {
  return uri.toLowerCase().includes('.glb');
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function wgs84ToEcef(lat: number, lng: number): [number, number, number] {
  const phi = toRadians(lat);
  const lambda = toRadians(lng);
  const cosPhi = Math.cos(phi);
  return [
    EARTH_RADIUS_M * cosPhi * Math.cos(lambda),
    EARTH_RADIUS_M * cosPhi * Math.sin(lambda),
    EARTH_RADIUS_M * Math.sin(phi),
  ];
}

function bboxCornersEcef(scope: SceneScope): Array<[number, number, number]> {
  const { lat, lng } = scope.center;
  const radius = scope.radiusMeters ?? 150;
  const dLat = (radius / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = (radius / (EARTH_RADIUS_M * Math.cos(toRadians(lat)))) * (180 / Math.PI);

  const points = [
    { lat: lat - dLat, lng: lng - dLng },
    { lat: lat - dLat, lng: lng + dLng },
    { lat: lat + dLat, lng: lng - dLng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat, lng },
  ];
  return points.map((p) => wgs84ToEcef(p.lat, p.lng));
}

function intersectsScope(box: number[] | undefined, transform: Mat4, scope: SceneScope): boolean {
  if (!box || box.length !== 12) return true;

  const center = transformPoint(transform, [box[0]!, box[1]!, box[2]!]);
  const axisX = transformVector(transform, [box[3]!, box[4]!, box[5]!]);
  const axisY = transformVector(transform, [box[6]!, box[7]!, box[8]!]);
  const axisZ = transformVector(transform, [box[9]!, box[10]!, box[11]!]);
  const sphereCenter = wgs84ToEcef(scope.center.lat, scope.center.lng);
  const sphereRadius = computeScopeSphereRadiusEcef(scope, sphereCenter);

  const corners = bboxCornersEcef(scope);
  for (const p of corners) {
    if (pointInObb(p, center, axisX, axisY, axisZ)) return true;
  }

  if (obbIntersectsSphere(center, axisX, axisY, axisZ, sphereCenter, sphereRadius)) return true;

  return false;
}

function computeScopeSphereRadiusEcef(
  scope: SceneScope,
  sphereCenter: [number, number, number],
): number {
  const ring = scope.coreArea.outer;
  if (ring.length > 0) {
    let maxDist = 0;
    for (const p of ring) {
      const ecef = wgs84ToEcef(p.lat, p.lng);
      const d = length(subtract(ecef, sphereCenter));
      if (d > maxDist) maxDist = d;
    }
    if (maxDist > 0) return maxDist;
  }
  return scope.radiusMeters ?? 150;
}

function pointInObb(
  point: [number, number, number],
  center: [number, number, number],
  axisX: [number, number, number],
  axisY: [number, number, number],
  axisZ: [number, number, number],
): boolean {
  const local = subtract(point, center);
  const projX = project(local, axisX);
  const projY = project(local, axisY);
  const projZ = project(local, axisZ);
  return Math.abs(projX) <= 1 && Math.abs(projY) <= 1 && Math.abs(projZ) <= 1;
}

function project(v: [number, number, number], axis: [number, number, number]): number {
  const denom = dot(axis, axis);
  if (denom <= 1e-9) return 0;
  return dot(v, axis) / denom;
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(v: [number, number, number]): number {
  return Math.sqrt(dot(v, v));
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = length(v);
  if (len <= 1e-9) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function obbIntersectsSphere(
  obbCenter: [number, number, number],
  axisX: [number, number, number],
  axisY: [number, number, number],
  axisZ: [number, number, number],
  sphereCenter: [number, number, number],
  sphereRadius: number,
): boolean {
  const uX = normalize(axisX);
  const uY = normalize(axisY);
  const uZ = normalize(axisZ);
  const hX = length(axisX);
  const hY = length(axisY);
  const hZ = length(axisZ);

  const d = subtract(sphereCenter, obbCenter);
  const pX = clamp(dot(d, uX), -hX, hX);
  const pY = clamp(dot(d, uY), -hY, hY);
  const pZ = clamp(dot(d, uZ), -hZ, hZ);

  const closest: [number, number, number] = [
    obbCenter[0] + uX[0] * pX + uY[0] * pY + uZ[0] * pZ,
    obbCenter[1] + uX[1] * pX + uY[1] * pY + uZ[1] * pZ,
    obbCenter[2] + uX[2] * pX + uY[2] * pY + uZ[2] * pZ,
  ];
  const delta = subtract(sphereCenter, closest);
  return dot(delta, delta) <= sphereRadius * sphereRadius;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function subtract(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function toMat4(input: number[] | undefined): Mat4 {
  if (!input || input.length !== 16) return IDENTITY;
  return [
    input[0]!, input[1]!, input[2]!, input[3]!,
    input[4]!, input[5]!, input[6]!, input[7]!,
    input[8]!, input[9]!, input[10]!, input[11]!,
    input[12]!, input[13]!, input[14]!, input[15]!,
  ];
}

function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        sum += a[row + i * 4]! * b[i + col * 4]!;
      }
      out[row + col * 4] = sum;
    }
  }
  return out as Mat4;
}

function transformPoint(m: Mat4, p: [number, number, number]): [number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function transformVector(m: Mat4, p: [number, number, number]): [number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2],
  ];
}
