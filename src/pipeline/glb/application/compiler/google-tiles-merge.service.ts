import { NodeIO, type Accessor, type Document, type Node, type Scene } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRDracoMeshCompression, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { copyToDocument, createDefaultPropertyResolver, dequantize, transformMesh } from '@gltf-transform/functions';
import { Injectable, Logger } from '@nestjs/common';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';

import type { GooglePhotorealTile } from '../../../../providers/infrastructure/google-3dtiles.adapter';

type MergeGoogleTilesInput = {
  document: Document;
  sceneRoot: Scene;
  tiles: GooglePhotorealTile[];
  scopeCenter: { lat: number; lng: number };
};

type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

const IDENTITY_MAT4: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Maps ENU(East=x, North=y, Up=z) → project scene(x=East, y=Up, z=North).
// Aligns with OSM entity coordinates: x=East, y=altitude, z=North (overpass.adapter toLocalPoint).
const ENU_TO_SCENE: Mat4 = [
  1, 0, 0, 0,   // col 0: East → x (unchanged)
  0, 0, 1, 0,   // col 1: North(y) → new_z
  0, 1, 0, 0,   // col 2: Up(z)    → new_y
  0, 0, 0, 1,
];

// Maps glTF Y-up → ECEF Z-up: (x, y, z) → (x, -z, y).
// 3D Tiles content GLBs are glTF Y-up; their node matrices bake the tile's
// ECEF position expressed in that Y-up frame. ecefToEnu expects standard
// Z-up ECEF, so vertices must be rotated back before localising.
const ZUP_FROM_GLTF: Mat4 = [
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
];

const WGS84_A = 6_378_137;
const WGS84_E2 = 6.69437999014e-3;
const MAX_GOOGLE_TILE_EXTENT_M = 5_000;
const MAX_GOOGLE_TILE_CENTER_DISTANCE_M = 10_000;

@Injectable()
export class GoogleTilesMergeService {
  private readonly logger = new Logger(GoogleTilesMergeService.name);

  async merge(input: MergeGoogleTilesInput): Promise<void> {
    if (input.tiles.length === 0) return;

    const io = await createGoogleTileIo();
    const rootNode = input.document.createNode('google_photoreal');
    input.sceneRoot.addChild(rootNode);

    const ecefToEnu = createEcefToEnuTransform(input.scopeCenter);
    let mergedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < input.tiles.length; i++) {
      const tile = input.tiles[i]!;
      const prepared = await prepareGoogleTile(io, tile.bytes, `google_tile_${i}`, ecefToEnu, i === 0 ? this.logger : undefined);
      if (!prepared) {
        skippedCount += 1;
        this.logger.warn(`Google photoreal tile skipped: index=${i} uri=${tile.uri} reason=empty`);
        continue;
      }

      if (!isSaneGoogleTileBounds(prepared.bounds)) {
        skippedCount += 1;
        this.logger.warn(
          `Google photoreal tile skipped: index=${i} uri=${tile.uri} geometricError=${tile.geometricError} bounds=${formatBounds(prepared.bounds)}`,
        );
        continue;
      }

      const resolver = createDefaultPropertyResolver(input.document, prepared.document);
      const map = copyToDocument(input.document, prepared.document, [prepared.node], resolver);
      const mappedTileNode = map.get(prepared.node) as Node | undefined;
      if (!mappedTileNode) {
        skippedCount += 1;
        this.logger.warn(`Google photoreal tile skipped: index=${i} copy failed uri=${tile.uri}`);
        continue;
      }

      rootNode.addChild(mappedTileNode);
      mergedCount += 1;
      this.logger.log(
        `Google photoreal tile accepted: index=${i} rtcCenter=${prepared.rtcCenter !== null} bounds=${formatBounds(prepared.bounds)}`,
      );
    }

    const bounds = calculateSubtreePositionBounds(rootNode);
    this.logger.log(
      `Google photoreal tiles merged: requested=${input.tiles.length} merged=${mergedCount} skipped=${skippedCount} bounds=${formatBounds(bounds)}`,
    );
  }
}

type PreparedGoogleTile = {
  document: Document;
  node: Node;
  bounds: Bounds;
  rtcCenter: [number, number, number] | null;
};

async function prepareGoogleTile(
  io: NodeIO,
  bytes: Uint8Array,
  nodeName: string,
  ecefToEnu: Mat4,
  logger?: { debug: (msg: string) => void },
): Promise<Omit<PreparedGoogleTile, 'strategy'> | null> {
  const document = await io.readBinary(bytes);
  await document.transform(dequantize());

  const sourceScene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (!sourceScene) return null;

  const children = sourceScene.listChildren();
  if (children.length === 0) return null;

  // Read the tile's ECEF center from CESIUM_RTC or scene extras.
  // Google photogrammetry vertices are in local ENU (small values relative to
  // this center). We position the tile node at the center's scene coordinates
  // rather than baking an ECEF transform into every vertex.
  const rtcCenter = readRtcCenterFromBytes(bytes);

  if (logger) {
    // Diagnostic: log rtcCenter and first raw vertex to identify tile coordinate format
    const firstPrim = document.getRoot().listMeshes()[0]?.listPrimitives()[0];
    const posArr = firstPrim?.getAttribute('POSITION')?.getArray();
    const v0 = posArr ? `[${posArr[0]?.toFixed(1)},${posArr[1]?.toFixed(1)},${posArr[2]?.toFixed(1)}]` : 'none';
    const firstChildMat = document.getRoot().listScenes()[0]?.listChildren()[0]?.getMatrix();
    const mat_t = firstChildMat ? `[${firstChildMat[12]?.toFixed(0)},${firstChildMat[13]?.toFixed(0)},${firstChildMat[14]?.toFixed(0)}]` : 'none';
    logger.debug(
      `${nodeName}: rtcCenter=${rtcCenter ? `[${rtcCenter.map(v=>v.toFixed(0)).join(',')}]` : 'null'} ` +
      `v0=${v0} child0_mat_t=${mat_t} bytes=${bytes.byteLength}`,
    );
  }

  const tileNode = document.createNode(nodeName);

  if (rtcCenter !== null) {
    // Convert ECEF center → local ENU → scene Y-up
    const centerEnu = multiplyMat4AsPoint(ecefToEnu, rtcCenter);
    const centerScene = applyENU_TO_SCENE(centerEnu);
    tileNode.setTranslation([centerScene[0], centerScene[1], centerScene[2]]);
  }
  // No RTC center → vertices are in ECEF; fall through to matrix-based path below

  for (const child of children) {
    tileNode.addChild(child);
  }

  // If we have an RTC center, vertices are in local ENU (no transform needed).
  // If not, we have no reliable ECEF position; bake the identity transform to
  // at least normalise the hierarchy.
  if (rtcCenter === null) {
    // Vertices ride node matrices in glTF Y-up ECEF. Rotate Y-up→Z-up, then
    // ECEF→ENU, then ENU→scene. Composed once on the tile root; child node
    // matrices (carrying the baked ECEF position) compose underneath.
    const toScene = multiplyMat4(multiplyMat4(ENU_TO_SCENE_MAT4, ecefToEnu), ZUP_FROM_GLTF);
    tileNode.setMatrix(toScene);
    bakeSubtreeToEnu(tileNode, IDENTITY_MAT4);
  }

  return {
    document,
    node: tileNode,
    bounds: calculateSubtreePositionBounds(tileNode),
    rtcCenter,
  };
}

// Reads CESIUM_RTC center directly from raw GLB bytes (JSON chunk).
// gltf-transform does NOT expose unregistered extensions via getExtras(),
// so we parse the GLB JSON chunk ourselves. Returns [X,Y,Z] ECEF or null.
function readRtcCenterFromBytes(bytes: Uint8Array): [number, number, number] | null {
  // GLB: magic(4) version(4) length(4) | JSON chunk: chunkLen(4) chunkType(4) data(N)
  if (bytes.byteLength < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  if (view.getUint32(0, true) !== 0x46546c67) return null; // 'glTF'
  const jsonLen = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a) return null; // 'JSON'
  if (bytes.byteLength < 20 + jsonLen) return null;

  let j: Record<string, unknown>;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
    if (!parsed || typeof parsed !== 'object') return null;
    j = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  // Standard location: extensions.CESIUM_RTC.center
  const exts = j['extensions'];
  if (exts && typeof exts === 'object') {
    const rtc = (exts as Record<string, unknown>)['CESIUM_RTC'];
    if (rtc && typeof rtc === 'object') {
      const c = (rtc as Record<string, unknown>)['center'];
      if (Array.isArray(c) && c.length >= 3) return [Number(c[0]), Number(c[1]), Number(c[2])];
    }
  }

  // Alternate: extras.RTC_CENTER
  const extras = j['extras'];
  if (extras && typeof extras === 'object') {
    const c = (extras as Record<string, unknown>)['RTC_CENTER'];
    if (Array.isArray(c) && c.length >= 3) return [Number(c[0]), Number(c[1]), Number(c[2])];
  }

  return null;
}

// Applies ecefToEnu matrix to an ECEF point (handles the w=1 column).
function multiplyMat4AsPoint(m: Mat4, p: [number, number, number]): [number, number, number] {
  return [
    m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
    m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
    m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
  ];
}

// Maps ENU(East, North, Up) → scene(x=East, y=Up, z=North).
function applyENU_TO_SCENE(enu: [number, number, number]): [number, number, number] {
  return [enu[0], enu[2], enu[1]];
}

const ENU_TO_SCENE_MAT4: Mat4 = ENU_TO_SCENE;

// Recursively bakes the full world transform (parent * local) into each mesh's
// vertex data, then resets the node to identity. Uses transformMesh directly
// rather than clearNodeTransform, which propagates parent→child in wrong order
// (child*parent instead of parent*child), corrupting ECEF-scale positions.
function bakeSubtreeToEnu(node: Node, parentWorld: Mat4): void {
  const local = node.getMatrix() as unknown as Mat4;
  const world = multiplyMat4(parentWorld, local);

  const mesh = node.getMesh();
  if (mesh !== null) {
    const bakedMesh = mesh.clone();
    node.setMesh(bakedMesh);
    transformMesh(bakedMesh, world as unknown as Parameters<typeof transformMesh>[1]);
  }

  for (const child of node.listChildren()) {
    bakeSubtreeToEnu(child, world);
  }

  node.setMatrix(IDENTITY_MAT4 as unknown as Parameters<typeof node.setMatrix>[0]);
}

type Bounds = {
  min: [number, number, number];
  max: [number, number, number];
  extent: [number, number, number];
} | null;

function calculateSubtreePositionBounds(root: Node): Bounds {
  const min: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let found = false;

  visitNode(root, (node) => {
    const mesh = node.getMesh();
    if (!mesh) return;

    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;

      updateBoundsFromAccessor(position, min, max);
      found = true;
    }
  });

  if (!found) return null;

  return {
    min,
    max,
    extent: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

function visitNode(node: Node, callback: (node: Node) => void): void {
  callback(node);
  for (const child of node.listChildren()) {
    visitNode(child, callback);
  }
}

function updateBoundsFromAccessor(
  accessor: Accessor,
  min: [number, number, number],
  max: [number, number, number],
): void {
  const array = accessor.getArray();
  if (!array) return;

  for (let i = 0; i < accessor.getCount(); i++) {
    const offset = i * 3;
    const x = array[offset]!;
    const y = array[offset + 1]!;
    const z = array[offset + 2]!;

    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
}

function formatBounds(bounds: Bounds): string {
  if (!bounds) return 'none';
  return `min=${formatVec3(bounds.min)} max=${formatVec3(bounds.max)} extent=${formatVec3(bounds.extent)}`;
}

function formatVec3(vec: [number, number, number]): string {
  return `[${vec.map((value) => Number.isFinite(value) ? value.toFixed(2) : String(value)).join(',')}]`;
}

function isSaneGoogleTileBounds(bounds: Bounds): boolean {
  if (!bounds) return false;

  const maxExtent = Math.max(...bounds.extent);
  if (!Number.isFinite(maxExtent) || maxExtent > MAX_GOOGLE_TILE_EXTENT_M) return false;

  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const centerDistance = Math.hypot(center[0]!, center[1]!, center[2]!);
  return Number.isFinite(centerDistance) && centerDistance <= MAX_GOOGLE_TILE_CENTER_DISTANCE_M;
}

async function createGoogleTileIo(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  await MeshoptDecoder.ready;

  const io = new NodeIO();
  io.registerExtensions([EXTMeshoptCompression, KHRDracoMeshCompression, KHRMaterialsUnlit]);
  io.registerDependencies({
    'draco3d.decoder': decoder,
    'meshopt.decoder': MeshoptDecoder,
  });
  await io.init();
  return io;
}

function createEcefToEnuTransform(origin: { lat: number; lng: number }): Mat4 {
  const phi = toRadians(origin.lat);
  const lambda = toRadians(origin.lng);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLambda = Math.sin(lambda);
  const cosLambda = Math.cos(lambda);

  const normalRadius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  const ox = normalRadius * cosPhi * cosLambda;
  const oy = normalRadius * cosPhi * sinLambda;
  const oz = normalRadius * (1 - WGS84_E2) * sinPhi;

  const tx = -(-sinLambda * ox + cosLambda * oy);
  const ty = -(-sinPhi * cosLambda * ox - sinPhi * sinLambda * oy + cosPhi * oz);
  const tz = -(cosPhi * cosLambda * ox + cosPhi * sinLambda * oy + sinPhi * oz);

  return [
    -sinLambda, -sinPhi * cosLambda, cosPhi * cosLambda, 0,
    cosLambda, -sinPhi * sinLambda, cosPhi * sinLambda, 0,
    0, cosPhi, sinPhi, 0,
    tx, ty, tz, 1,
  ];
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
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
