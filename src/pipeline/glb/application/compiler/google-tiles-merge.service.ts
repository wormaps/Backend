import { NodeIO, type Document, type Node, type Scene } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { copyToDocument, createDefaultPropertyResolver, dequantize } from '@gltf-transform/functions';
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

const Y_UP_TO_Z_UP: Mat4 = [
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
];

const EARTH_RADIUS_M = 6_371_000;

@Injectable()
export class GoogleTilesMergeService {
  private readonly logger = new Logger(GoogleTilesMergeService.name);

  async merge(input: MergeGoogleTilesInput): Promise<void> {
    if (input.tiles.length === 0) return;

    const io = await createGoogleTileIo();
    const rootNode = input.document.createNode('google_photoreal');
    input.sceneRoot.addChild(rootNode);

    const ecefToEnu = createEcefToEnuTransform(input.scopeCenter);

    for (let i = 0; i < input.tiles.length; i++) {
      const tile = input.tiles[i]!;
      if (!tile.uri.toLowerCase().includes('.glb')) continue;
      const src = await io.readBinary(tile.bytes);
      await src.transform(dequantize());

      const sourceScene = src.getRoot().getDefaultScene() ?? src.getRoot().listScenes()[0];
      if (!sourceScene) continue;

      const children = sourceScene.listChildren();
      if (children.length === 0) continue;

      const resolver = createDefaultPropertyResolver(input.document, src);
      const map = copyToDocument(input.document, src, children, resolver);

      const tileNode = input.document.createNode(`google_tile_${i}`);
      tileNode.setMatrix(multiplyMat4(ecefToEnu, multiplyMat4(tile.transform, Y_UP_TO_Z_UP)));

      for (const child of children) {
        const mapped = map.get(child) as Node | undefined;
        if (mapped) tileNode.addChild(mapped);
      }

      rootNode.addChild(tileNode);
    }

    this.logger.log(`Google photoreal tiles merged: ${input.tiles.length}`);
  }
}

async function createGoogleTileIo(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  await MeshoptDecoder.ready;

  const io = new NodeIO();
  io.registerExtensions([EXTMeshoptCompression, KHRDracoMeshCompression]);
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

  const ox = EARTH_RADIUS_M * cosPhi * cosLambda;
  const oy = EARTH_RADIUS_M * cosPhi * sinLambda;
  const oz = EARTH_RADIUS_M * sinPhi;

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
