import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Coordinate } from '../places/place.types';
import { buildSceneAssetSelection } from '../scene/scene-asset-profile.utils';
import { getSceneDataDir } from '../scene/scene-storage.utils';
import {
  MaterialClass,
  SceneCrossingDetail,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
  SceneSignageCluster,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
} from '../scene/scene.types';

type Vec3 = [number, number, number];

interface GeometryBuffers {
  positions: number[];
  normals: number[];
  indices: number[];
}

interface Vec2 {
  x: number;
  z: number;
}

@Injectable()
export class GlbBuilderService {
  async build(sceneMeta: SceneMeta, sceneDetail: SceneDetail): Promise<string> {
    const gltf = await import('@gltf-transform/core');
    const earcutModule = await import('earcut');
    const validatorModule = await import('gltf-validator');
    const triangulate = earcutModule.default;
    const { Accessor, Document, NodeIO } = gltf;
    const doc = new Document();
    const buffer = doc.createBuffer('scene-buffer');
    const scene = doc.createScene(sceneMeta.sceneId);
    const assetSelection = buildSceneAssetSelection(
      sceneMeta,
      sceneDetail,
      sceneMeta.assetProfile.preset,
    );

    const materials = this.createMaterials(doc);

    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'ground',
      this.createGroundGeometry(sceneMeta),
      materials.ground,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'road_base',
      this.createRoadBaseGeometry(sceneMeta.origin, assetSelection.roads),
      materials.roadBase,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'road_markings',
      this.createRoadMarkingsGeometry(sceneMeta.origin, sceneDetail.roadMarkings),
      materials.roadMarking,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'crosswalk_decals',
      this.createCrosswalkGeometry(sceneMeta.origin, assetSelection.crossings),
      materials.crosswalk,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'sidewalk',
      this.createWalkwayGeometry(sceneMeta.origin, assetSelection.walkways),
      materials.sidewalk,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'traffic_lights',
      this.createStreetFurnitureGeometry(
        sceneMeta.origin,
        assetSelection.trafficLights,
        'TRAFFIC_LIGHT',
      ),
      materials.trafficLight,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'street_lights',
      this.createStreetFurnitureGeometry(
        sceneMeta.origin,
        assetSelection.streetLights,
        'STREET_LIGHT',
      ),
      materials.streetLight,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'sign_poles',
      this.createStreetFurnitureGeometry(
        sceneMeta.origin,
        assetSelection.signPoles,
        'SIGN_POLE',
      ),
      materials.signPole,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'trees_planters',
      this.createVegetationGeometry(sceneMeta.origin, assetSelection.vegetation),
      materials.tree,
    );

    const materialHintMap = new Map(
      sceneDetail.facadeHints.map((hint) => [hint.objectId, hint]),
    );
    const groupedBuildings = new Map<MaterialClass, typeof sceneMeta.buildings>();
    for (const building of assetSelection.buildings) {
      const hint = materialHintMap.get(building.objectId);
      const materialClass = hint?.materialClass ?? 'mixed';
      const current = groupedBuildings.get(materialClass) ?? [];
      current.push(building);
      groupedBuildings.set(materialClass, current);
    }

    for (const [materialClass, buildings] of groupedBuildings.entries()) {
      this.addMeshNode(
        doc,
        Accessor,
        scene,
        buffer,
        `building_shells_${materialClass}`,
        this.createBuildingShellGeometry(sceneMeta.origin, buildings, triangulate),
        materials.buildingShells[materialClass],
      );
    }

    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_panels',
      this.createBuildingPanelsGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        sceneDetail.facadeHints,
      ),
      materials.buildingPanel,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'billboards',
      this.createBillboardsGeometry(sceneMeta.origin, assetSelection.billboardPanels),
      materials.billboard,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'landmark_extras',
      this.createLandmarkExtrasGeometry(
        sceneMeta.origin,
        sceneMeta.landmarkAnchors,
        sceneDetail.signageClusters,
      ),
      materials.landmark,
    );

    const outputPath = join(getSceneDataDir(), `${sceneMeta.sceneId}.glb`);
    await mkdir(dirname(outputPath), { recursive: true });
    const glbBinary = await new NodeIO().writeBinary(doc);
    await this.validateGlb(
      Uint8Array.from(glbBinary),
      sceneMeta.sceneId,
      validatorModule,
    );
    await writeFile(outputPath, glbBinary);

    return outputPath;
  }

  private createMaterials(doc: any) {
    return {
      ground: doc
        .createMaterial('ground')
        .setBaseColorFactor([0.9, 0.9, 0.88, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1),
      roadBase: doc
        .createMaterial('road-base')
        .setBaseColorFactor([0.16, 0.17, 0.19, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1),
      roadMarking: doc
        .createMaterial('road-marking')
        .setBaseColorFactor([0.95, 0.94, 0.78, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.8),
      crosswalk: doc
        .createMaterial('crosswalk')
        .setBaseColorFactor([0.97, 0.97, 0.97, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.9),
      sidewalk: doc
        .createMaterial('sidewalk')
        .setBaseColorFactor([0.72, 0.72, 0.7, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1),
      trafficLight: doc
        .createMaterial('traffic-light')
        .setBaseColorFactor([0.18, 0.19, 0.2, 1])
        .setEmissiveFactor([0.22, 0.05, 0.02])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.9),
      streetLight: doc
        .createMaterial('street-light')
        .setBaseColorFactor([0.45, 0.46, 0.48, 1])
        .setEmissiveFactor([0.15, 0.12, 0.05])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.7),
      signPole: doc
        .createMaterial('sign-pole')
        .setBaseColorFactor([0.52, 0.55, 0.58, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.7),
      tree: doc
        .createMaterial('tree')
        .setBaseColorFactor([0.28, 0.47, 0.27, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1),
      buildingShells: {
        glass: this.makeColorMaterial(doc, 'building-shell-glass', '#8eb7d9'),
        concrete: this.makeColorMaterial(
          doc,
          'building-shell-concrete',
          '#aab1b8',
        ),
        brick: this.makeColorMaterial(doc, 'building-shell-brick', '#a65b42'),
        metal: this.makeColorMaterial(doc, 'building-shell-metal', '#8b949d'),
        mixed: this.makeColorMaterial(doc, 'building-shell-mixed', '#9ea4aa'),
      } as Record<MaterialClass, any>,
      buildingPanel: doc
        .createMaterial('building-panel')
        .setBaseColorFactor([0.17, 0.2, 0.25, 1])
        .setEmissiveFactor([0.16, 0.2, 0.24])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.75),
      billboard: doc
        .createMaterial('billboard')
        .setBaseColorFactor([0.95, 0.36, 0.28, 1])
        .setEmissiveFactor([0.55, 0.18, 0.08])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.7),
      landmark: doc
        .createMaterial('landmark')
        .setBaseColorFactor([0.96, 0.73, 0.18, 1])
        .setEmissiveFactor([0.25, 0.17, 0.05])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.75),
    };
  }

  private makeColorMaterial(doc: any, name: string, hex: string) {
    const [r, g, b] = this.hexToRgb(hex);
    return doc
      .createMaterial(name)
      .setBaseColorFactor([r, g, b, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.95);
  }

  private addMeshNode(
    doc: any,
    AccessorRef: any,
    scene: any,
    buffer: any,
    name: string,
    geometry: GeometryBuffers,
    material: any,
  ): void {
    if (!this.isGeometryValid(geometry)) {
      return;
    }

    const mesh = doc.createMesh(name);
    const primitive = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc
          .createAccessor(`${name}-positions`, buffer)
          .setArray(new Float32Array(geometry.positions))
          .setType(AccessorRef.Type.VEC3),
      )
      .setAttribute(
        'NORMAL',
        doc
          .createAccessor(`${name}-normals`, buffer)
          .setArray(new Float32Array(geometry.normals))
          .setType(AccessorRef.Type.VEC3),
      )
      .setIndices(
        doc
          .createAccessor(`${name}-indices`, buffer)
          .setArray(new Uint32Array(geometry.indices))
          .setType(AccessorRef.Type.SCALAR),
      )
      .setMaterial(material);

    mesh.addPrimitive(primitive);
    scene.addChild(doc.createNode(name).setMesh(mesh));
  }

  private createGroundGeometry(sceneMeta: SceneMeta): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    const ne = this.toLocalPoint(sceneMeta.origin, sceneMeta.bounds.northEast);
    const sw = this.toLocalPoint(sceneMeta.origin, sceneMeta.bounds.southWest);
    this.pushQuad(
      geometry,
      [sw[0], -0.03, ne[2]],
      [ne[0], -0.03, ne[2]],
      [ne[0], -0.03, sw[2]],
      [sw[0], -0.03, sw[2]],
    );
    return geometry;
  }

  private createRoadBaseGeometry(
    origin: Coordinate,
    roads: SceneMeta['roads'],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    for (const road of roads) {
      this.pushPathStrips(
        origin,
        geometry,
        road.path,
        Math.max(3.2, road.widthMeters),
        0.01,
      );
    }
    return geometry;
  }

  private createRoadMarkingsGeometry(
    origin: Coordinate,
    markings: SceneDetail['roadMarkings'],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    for (const marking of markings) {
      const width =
        marking.type === 'LANE_LINE'
          ? 0.24
          : marking.type === 'STOP_LINE'
            ? 0.55
            : 1.6;
      this.pushPathStrips(origin, geometry, marking.path, width, 0.03);
    }
    return geometry;
  }

  private createCrosswalkGeometry(
    origin: Coordinate,
    crossings: SceneCrossingDetail[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    for (const crossing of crossings) {
      const local = crossing.path
        .map((point) => this.toLocalPoint(origin, point))
        .filter((point) => this.isFiniteVec3(point));
      if (local.length < 2) {
        continue;
      }

      const start = local[0];
      const end = local[local.length - 1];
      const direction = this.normalize2d({
        x: end[0] - start[0],
        z: end[2] - start[2],
      });
      const normal = { x: -direction.z, z: direction.x };
      const length = Math.hypot(end[0] - start[0], end[2] - start[2]);
      const stripeCount = Math.max(4, Math.min(9, Math.floor(length / 1.4)));
      const stripeDepth = 0.55;
      const halfWidth = crossing.principal ? 6 : 4;

      for (let i = 0; i < stripeCount; i += 1) {
        const t = (i + 0.5) / stripeCount;
        const centerX = start[0] + (end[0] - start[0]) * t;
        const centerZ = start[2] + (end[2] - start[2]) * t;
        const dx = direction.x * stripeDepth;
        const dz = direction.z * stripeDepth;
        const nx = normal.x * halfWidth;
        const nz = normal.z * halfWidth;
        this.pushQuad(
          geometry,
          [centerX - dx - nx, 0.04, centerZ - dz - nz],
          [centerX + dx - nx, 0.04, centerZ + dz - nz],
          [centerX + dx + nx, 0.04, centerZ + dz + nz],
          [centerX - dx + nx, 0.04, centerZ - dz + nz],
        );
      }
    }
    return geometry;
  }

  private createWalkwayGeometry(
    origin: Coordinate,
    walkways: SceneMeta['walkways'],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    for (const walkway of walkways) {
      this.pushPathStrips(
        origin,
        geometry,
        walkway.path,
        Math.max(2, walkway.widthMeters),
        0.015,
      );
    }
    return geometry;
  }

  private createStreetFurnitureGeometry(
    origin: Coordinate,
    items: SceneStreetFurnitureDetail[],
    type: SceneStreetFurnitureDetail['type'],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    for (const item of items) {
      if (item.type !== type) {
        continue;
      }
      const center = this.toLocalPoint(origin, item.location);
      if (!this.isFiniteVec3(center)) {
        continue;
      }
      const poleHeight =
        type === 'TRAFFIC_LIGHT' ? 6.8 : type === 'STREET_LIGHT' ? 8.5 : 3.6;
      this.pushBox(
        geometry,
        [center[0] - 0.08, 0, center[2] - 0.08],
        [center[0] + 0.08, poleHeight, center[2] + 0.08],
      );
      if (type === 'TRAFFIC_LIGHT') {
        this.pushBox(
          geometry,
          [center[0] - 1.1, poleHeight - 0.32, center[2] - 0.05],
          [center[0] + 0.1, poleHeight - 0.12, center[2] + 0.05],
        );
        this.pushBox(
          geometry,
          [center[0] - 1.08, poleHeight - 0.7, center[2] - 0.18],
          [center[0] - 0.78, poleHeight - 0.24, center[2] + 0.18],
        );
      } else if (type === 'STREET_LIGHT') {
        this.pushBox(
          geometry,
          [center[0] - 0.15, poleHeight - 0.2, center[2] - 0.15],
          [center[0] + 0.9, poleHeight, center[2] + 0.15],
        );
        this.pushBox(
          geometry,
          [center[0] + 0.65, poleHeight - 0.18, center[2] - 0.22],
          [center[0] + 1.02, poleHeight + 0.08, center[2] + 0.22],
        );
      } else {
        this.pushBox(
          geometry,
          [center[0] - 0.28, poleHeight - 0.7, center[2] - 0.04],
          [center[0] + 0.28, poleHeight - 0.1, center[2] + 0.04],
        );
      }
    }
    return geometry;
  }

  private createVegetationGeometry(
    origin: Coordinate,
    items: SceneVegetationDetail[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    for (const item of items) {
      const center = this.toLocalPoint(origin, item.location);
      if (!this.isFiniteVec3(center)) {
        continue;
      }
      const radius = Math.max(0.8, item.radiusMeters * 0.5);
      this.pushBox(
        geometry,
        [center[0] - 0.08, 0, center[2] - 0.08],
        [center[0] + 0.08, 1.4, center[2] + 0.08],
      );
      if (geometry.indices.length % 2 === 0) {
        this.pushBox(
          geometry,
          [center[0] - radius, 1.1, center[2] - radius * 0.85],
          [center[0] + radius, 2.5, center[2] + radius * 0.85],
        );
        this.pushBox(
          geometry,
          [center[0] - radius * 0.72, 2.15, center[2] - radius * 0.72],
          [center[0] + radius * 0.72, 3.2, center[2] + radius * 0.72],
        );
      } else {
        this.pushBox(
          geometry,
          [center[0] - radius * 0.7, 1.2, center[2] - radius],
          [center[0] + radius * 0.7, 2.7, center[2] + radius],
        );
        this.pushBox(
          geometry,
          [center[0] - radius, 1.8, center[2] - radius * 0.55],
          [center[0] + radius, 2.9, center[2] + radius * 0.55],
        );
      }
    }
    return geometry;
  }

  private createBuildingShellGeometry(
    origin: Coordinate,
    buildings: SceneMeta['buildings'],
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const building of buildings) {
      const outerRing = this.toLocalRing(origin, building.outerRing);
      const holes = building.holes
        .map((ring) => this.toLocalRing(origin, ring))
        .filter((ring) => ring.length >= 3);
      if (outerRing.length < 3) {
        continue;
      }

      const height = Math.max(4, building.heightMeters);
      const roofBaseHeight =
        building.roofType === 'stepped'
          ? height * 0.78
          : building.roofType === 'gable'
            ? height * 0.74
            : height;
      const triangulated = this.triangulateRings(outerRing, holes, triangulate);
      if (triangulated.length === 0) {
        continue;
      }

      for (const [a, b, c] of triangulated) {
        this.pushTriangle(geometry, [a[0], roofBaseHeight, a[2]], [b[0], roofBaseHeight, b[2]], [c[0], roofBaseHeight, c[2]]);
        this.pushTriangle(geometry, [a[0], 0, a[2]], [c[0], 0, c[2]], [b[0], 0, b[2]]);
      }

      this.pushRingWalls(geometry, outerRing, roofBaseHeight, false);
      for (const hole of holes) {
        this.pushRingWalls(geometry, hole, roofBaseHeight, true);
      }

      if (building.roofType === 'stepped') {
        this.pushSteppedRoof(geometry, outerRing, roofBaseHeight, height, triangulate);
      } else if (building.roofType === 'gable') {
        this.pushGableRoof(geometry, outerRing, roofBaseHeight, height);
      }
    }

    return geometry;
  }

  private createBuildingPanelsGeometry(
    origin: Coordinate,
    buildings: SceneMeta['buildings'],
    facadeHints: SceneFacadeHint[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));

    for (const building of buildings) {
      const hint = hintMap.get(building.objectId);
      if (!hint || hint.signageDensity === 'low') {
        continue;
      }

      const outerRing = this.toLocalRing(origin, building.outerRing);
      const edgeIndex =
        hint.facadeEdgeIndex !== null &&
        hint.facadeEdgeIndex >= 0 &&
        hint.facadeEdgeIndex < outerRing.length
          ? hint.facadeEdgeIndex
          : this.resolveLongestEdgeIndex(outerRing);
      const frame = this.buildFacadeFrame(
        outerRing,
        edgeIndex,
        Math.max(6, building.heightMeters * 0.78),
      );
      if (!frame) {
        continue;
      }

      const bandCount = Math.max(1, hint.windowBands);
      const margin = 0.6;
      const step = Math.max(1.4, (frame.height - margin * 2) / bandCount);
      for (let band = 0; band < bandCount; band += 1) {
        const y0 = Math.min(frame.height - 0.7, margin + band * step);
        const y1 = Math.min(frame.height - 0.2, y0 + Math.min(0.95, step * 0.45));
        if (y1 <= y0 + 0.1) {
          continue;
        }
        this.pushQuad(
          geometry,
          [frame.a[0], y0, frame.a[2]],
          [frame.b[0], y0, frame.b[2]],
          [frame.b[0], y1, frame.b[2]],
          [frame.a[0], y1, frame.a[2]],
        );
      }

      if (hint.billboardEligible) {
        const topStart = Math.max(frame.height * 0.58, frame.height - 4.2);
        const topEnd = Math.min(frame.height - 0.4, topStart + 2.8);
        this.pushQuad(
          geometry,
          [frame.a[0], topStart, frame.a[2]],
          [frame.b[0], topStart, frame.b[2]],
          [frame.b[0], topEnd, frame.b[2]],
          [frame.a[0], topEnd, frame.a[2]],
        );
      }
    }

    return geometry;
  }

  private createBillboardsGeometry(
    origin: Coordinate,
    clusters: SceneSignageCluster[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const cluster of clusters) {
      const anchor = this.toLocalPoint(origin, cluster.anchor);
      const poleWidth = 0.08;
      this.pushBox(
        geometry,
        [anchor[0] - poleWidth, 0, anchor[2] - poleWidth],
        [anchor[0] + poleWidth, 4.6, anchor[2] + poleWidth],
      );
      this.pushQuad(
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

  private createLandmarkExtrasGeometry(
    origin: Coordinate,
    anchors: SceneMeta['landmarkAnchors'],
    clusters: SceneSignageCluster[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    for (const anchor of anchors.slice(0, 8)) {
      const center = this.toLocalPoint(origin, anchor.location);
      const size = anchor.kind === 'CROSSING' ? 1.2 : 0.8;
      this.pushBox(
        geometry,
        [center[0] - size, 0.02, center[2] - size],
        [center[0] + size, 0.18, center[2] + size],
      );
    }

    for (const cluster of clusters.slice(0, 6)) {
      const anchor = this.toLocalPoint(origin, cluster.anchor);
      this.pushBox(
        geometry,
        [anchor[0] - 0.2, 6.2, anchor[2] - 0.2],
        [anchor[0] + 0.2, 7.2, anchor[2] + 0.2],
      );
    }

    return geometry;
  }

  private pushPathStrips(
    origin: Coordinate,
    geometry: GeometryBuffers,
    path: Coordinate[],
    width: number,
    y: number,
  ): void {
    const localPath = path
      .map((point) => this.toLocalPoint(origin, point))
      .filter((point) => this.isFiniteVec3(point))
      .filter((point, index, array) => {
        const prev = array[index - 1];
        return !prev || !this.samePointXZ(prev, point);
      });

    if (localPath.length < 2) {
      return;
    }

    const half = width / 2;
    const left: Vec3[] = [];
    const right: Vec3[] = [];

    for (let i = 0; i < localPath.length; i += 1) {
      const current = localPath[i];
      const prev = localPath[i - 1] ?? current;
      const next = localPath[i + 1] ?? current;
      const normal = this.computePathNormal(prev, current, next);
      if (!this.isFiniteVec2(normal)) {
        continue;
      }
      left.push([current[0] + normal[0] * half, y, current[2] + normal[1] * half]);
      right.push([
        current[0] - normal[0] * half,
        y,
        current[2] - normal[1] * half,
      ]);
    }

    for (let i = 0; i < localPath.length - 1; i += 1) {
      if (!left[i] || !right[i] || !left[i + 1] || !right[i + 1]) {
        continue;
      }
      this.pushQuad(geometry, left[i], right[i], right[i + 1], left[i + 1]);
    }
  }

  private pushBox(geometry: GeometryBuffers, min: Vec3, max: Vec3): void {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    this.pushQuad(geometry, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    this.pushQuad(geometry, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    this.pushQuad(geometry, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    this.pushQuad(geometry, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    this.pushQuad(geometry, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    this.pushQuad(geometry, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  }

  private pushQuad(
    geometry: GeometryBuffers,
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
  ): void {
    this.pushTriangle(geometry, a, b, c);
    this.pushTriangle(geometry, a, c, d);
  }

  private pushTriangle(
    geometry: GeometryBuffers,
    a: Vec3,
    b: Vec3,
    c: Vec3,
  ): void {
    const normal = this.computeNormal(a, b, c);
    if (normal === null) {
      return;
    }
    const baseIndex = geometry.positions.length / 3;
    geometry.positions.push(...a, ...b, ...c);
    geometry.normals.push(...normal, ...normal, ...normal);
    geometry.indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  }

  private computeNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
    if (![a, b, c].every((point) => this.isFiniteVec3(point))) {
      return null;
    }

    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross: Vec3 = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(cross[0], cross[1], cross[2]);
    if (!Number.isFinite(length) || length <= 1e-6) {
      return null;
    }

    return [cross[0] / length, cross[1] / length, cross[2] / length];
  }

  private computePathNormal(
    prev: Vec3,
    current: Vec3,
    next: Vec3,
  ): [number, number] {
    const inDir = this.normalize2d({
      x: current[0] - prev[0],
      z: current[2] - prev[2],
    });
    const outDir = this.normalize2d({
      x: next[0] - current[0],
      z: next[2] - current[2],
    });

    const tangent = this.normalize2d({
      x: inDir.x + outDir.x,
      z: inDir.z + outDir.z,
    });

    if (tangent.x === 0 && tangent.z === 0) {
      if (inDir.x === 0 && inDir.z === 0) {
        return [0, 1];
      }
      return [-inDir.z, inDir.x];
    }

    return [-tangent.z, tangent.x];
  }

  private normalize2d(vector: Vec2): Vec2 {
    const length = Math.hypot(vector.x, vector.z);
    if (length === 0) {
      return { x: 0, z: 0 };
    }
    return {
      x: vector.x / length,
      z: vector.z / length,
    };
  }

  private toLocalRing(origin: Coordinate, points: Coordinate[]): Vec3[] {
    const deduped = points.filter((point, index) => {
      const prev = points[index - 1];
      return !prev || prev.lat !== point.lat || prev.lng !== point.lng;
    });
    const normalized = [...deduped];
    if (normalized.length > 1) {
      const first = normalized[0];
      const last = normalized[normalized.length - 1];
      if (first.lat === last.lat && first.lng === last.lng) {
        normalized.pop();
      }
    }

    return normalized
      .map((point) => this.toLocalPoint(origin, point))
      .filter((point) => this.isFiniteVec3(point));
  }

  private triangulateRings(
    outerRing: Vec3[],
    holes: Vec3[][],
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ): Array<[Vec3, Vec3, Vec3]> {
    const vertices: number[] = [];
    const points: Vec3[] = [];
    const holeIndices: number[] = [];

    const pushRing = (ring: Vec3[]) => {
      for (const point of ring) {
        points.push(point);
        vertices.push(point[0], point[2]);
      }
    };

    pushRing(outerRing);
    for (const hole of holes) {
      holeIndices.push(points.length);
      pushRing(hole);
    }

    const indices = triangulate(vertices, holeIndices, 2);
    const triangles: Array<[Vec3, Vec3, Vec3]> = [];
    for (let index = 0; index < indices.length; index += 3) {
      const a = points[indices[index]];
      const b = points[indices[index + 1]];
      const c = points[indices[index + 2]];
      if (!a || !b || !c) {
        continue;
      }
      if (this.samePointXZ(a, b) || this.samePointXZ(b, c) || this.samePointXZ(a, c)) {
        continue;
      }
      triangles.push([a, b, c]);
    }

    return triangles;
  }

  private pushRingWalls(
    geometry: GeometryBuffers,
    ring: Vec3[],
    height: number,
    invert: boolean,
  ): void {
    this.pushRingWallsBetween(geometry, ring, 0, height, invert);
  }

  private pushRingWallsBetween(
    geometry: GeometryBuffers,
    ring: Vec3[],
    minHeight: number,
    maxHeight: number,
    invert: boolean,
  ): void {
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      if (invert) {
        this.pushQuad(
          geometry,
          [next[0], minHeight, next[2]],
          [current[0], minHeight, current[2]],
          [current[0], maxHeight, current[2]],
          [next[0], maxHeight, next[2]],
        );
      } else {
        this.pushQuad(
          geometry,
          [current[0], minHeight, current[2]],
          [next[0], minHeight, next[2]],
          [next[0], maxHeight, next[2]],
          [current[0], maxHeight, current[2]],
        );
      }
    }
  }

  private pushSteppedRoof(
    geometry: GeometryBuffers,
    outerRing: Vec3[],
    roofBaseHeight: number,
    topHeight: number,
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ): void {
    const insetRing = this.insetRing(outerRing, 0.16);
    if (insetRing.length < 3) {
      return;
    }
    const roofTriangles = this.triangulateRings(insetRing, [], triangulate);
    for (const [a, b, c] of roofTriangles) {
      this.pushTriangle(geometry, [a[0], topHeight, a[2]], [b[0], topHeight, b[2]], [c[0], topHeight, c[2]]);
    }
    this.pushRingWallsBetween(
      geometry,
      insetRing,
      roofBaseHeight,
      topHeight,
      false,
    );
    for (let index = 0; index < outerRing.length; index += 1) {
      const current = outerRing[index];
      const next = outerRing[(index + 1) % outerRing.length];
      const insetCurrent = insetRing[index % insetRing.length];
      const insetNext = insetRing[(index + 1) % insetRing.length];
      this.pushQuad(
        geometry,
        [current[0], roofBaseHeight, current[2]],
        [next[0], roofBaseHeight, next[2]],
        [insetNext[0], topHeight, insetNext[2]],
        [insetCurrent[0], topHeight, insetCurrent[2]],
      );
    }
  }

  private pushGableRoof(
    geometry: GeometryBuffers,
    outerRing: Vec3[],
    roofBaseHeight: number,
    topHeight: number,
  ): void {
    const bounds = this.computeBounds(outerRing);
    const ridgeAlongX = bounds.width >= bounds.depth;
    const ridgeHeight = Math.max(topHeight, roofBaseHeight + 1.1);
    const ridgeA: Vec3 = ridgeAlongX
      ? [bounds.minX, ridgeHeight, (bounds.minZ + bounds.maxZ) / 2]
      : [(bounds.minX + bounds.maxX) / 2, ridgeHeight, bounds.minZ];
    const ridgeB: Vec3 = ridgeAlongX
      ? [bounds.maxX, ridgeHeight, (bounds.minZ + bounds.maxZ) / 2]
      : [(bounds.minX + bounds.maxX) / 2, ridgeHeight, bounds.maxZ];

    for (let index = 0; index < outerRing.length; index += 1) {
      const current = outerRing[index];
      const next = outerRing[(index + 1) % outerRing.length];
      const currentRidge = ridgeAlongX
        ? [current[0], ridgeHeight, ridgeA[2]] as Vec3
        : [ridgeA[0], ridgeHeight, current[2]] as Vec3;
      const nextRidge = ridgeAlongX
        ? [next[0], ridgeHeight, ridgeA[2]] as Vec3
        : [ridgeA[0], ridgeHeight, next[2]] as Vec3;
      this.pushQuad(
        geometry,
        [current[0], roofBaseHeight, current[2]],
        [next[0], roofBaseHeight, next[2]],
        nextRidge,
        currentRidge,
      );
    }

    this.pushTriangle(geometry, [bounds.minX, roofBaseHeight, bounds.minZ], [bounds.minX, roofBaseHeight, bounds.maxZ], ridgeA);
    this.pushTriangle(geometry, [bounds.maxX, roofBaseHeight, bounds.maxZ], [bounds.maxX, roofBaseHeight, bounds.minZ], ridgeB);
  }

  private insetRing(points: Vec3[], ratio: number): Vec3[] {
    const center = this.averagePoint(points);
    return points.map((point) => [
      center[0] + (point[0] - center[0]) * (1 - ratio),
      0,
      center[2] + (point[2] - center[2]) * (1 - ratio),
    ]);
  }

  private averagePoint(points: Vec3[]): Vec3 {
    const total = points.reduce(
      (acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]] as Vec3,
      [0, 0, 0],
    );
    return [total[0] / points.length, 0, total[2] / points.length];
  }

  private resolveLongestEdgeIndex(points: Vec3[]): number {
    let longestIndex = 0;
    let longestLength = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const length = Math.hypot(next[0] - current[0], next[2] - current[2]);
      if (length > longestLength) {
        longestLength = length;
        longestIndex = index;
      }
    }
    return longestIndex;
  }

  private buildFacadeFrame(
    ring: Vec3[],
    edgeIndex: number,
    facadeHeight: number,
  ): { a: Vec3; b: Vec3; height: number } | null {
    const current = ring[edgeIndex];
    const next = ring[(edgeIndex + 1) % ring.length];
    if (!current || !next) {
      return null;
    }
    const centroid = this.averagePoint(ring);
    const edge = [next[0] - current[0], 0, next[2] - current[2]] as Vec3;
    const edgeLength = Math.hypot(edge[0], edge[2]);
    if (edgeLength <= 0.4) {
      return null;
    }
    let normal: Vec3 = [-edge[2] / edgeLength, 0, edge[0] / edgeLength];
    const midpoint: Vec3 = [(current[0] + next[0]) / 2, 0, (current[2] + next[2]) / 2];
    const toCentroid: Vec3 = [centroid[0] - midpoint[0], 0, centroid[2] - midpoint[2]];
    if (normal[0] * toCentroid[0] + normal[2] * toCentroid[2] > 0) {
      normal = [-normal[0], 0, -normal[2]];
    }
    const offset = 0.18;
    return {
      a: [current[0] + normal[0] * offset, 0, current[2] + normal[2] * offset],
      b: [next[0] + normal[0] * offset, 0, next[2] + normal[2] * offset],
      height: facadeHeight,
    };
  }

  private computeBounds(points: Vec3[]) {
    const xs = points.map((point) => point[0]);
    const zs = points.map((point) => point[2]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
      width: Math.max(...xs) - Math.min(...xs),
      depth: Math.max(...zs) - Math.min(...zs),
    };
  }

  private toLocalPoint(origin: Coordinate, point: Coordinate): Vec3 {
    const metersPerLat = 111_320;
    const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
    const x = (point.lng - origin.lng) * metersPerLng;
    const z = -(point.lat - origin.lat) * metersPerLat;
    return [x, 0, z];
  }

  private createEmptyGeometry(): GeometryBuffers {
    return {
      positions: [],
      normals: [],
      indices: [],
    };
  }

  private isGeometryValid(geometry: GeometryBuffers): boolean {
    if (geometry.indices.length === 0 || geometry.positions.length === 0) {
      return false;
    }

    if (
      geometry.positions.length % 3 !== 0 ||
      geometry.normals.length !== geometry.positions.length ||
      geometry.indices.some((index) => !Number.isInteger(index) || index < 0)
    ) {
      throw new Error('GLB geometry buffer shape is invalid.');
    }

    if (
      geometry.positions.some((value) => !Number.isFinite(value)) ||
      geometry.normals.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('GLB geometry contains non-finite vertex data.');
    }

    return true;
  }

  private async validateGlb(
    glbBinary: Uint8Array,
    sceneId: string,
    validatorModule: {
      validateBytes: (data: Uint8Array, options?: Record<string, unknown>) => Promise<unknown>;
    },
  ): Promise<void> {
    const report = (await validatorModule.validateBytes(glbBinary, {
      uri: `${sceneId}.glb`,
      maxIssues: 1000,
    })) as {
      issues?: {
        numErrors?: number;
        messages?: Array<{ code?: string; message?: string; pointer?: string }>;
      };
    };

    const numErrors = report.issues?.numErrors ?? 0;
    if (numErrors > 0) {
      const detail = report.issues?.messages
        ?.slice(0, 5)
        .map(
          (issue) =>
            `${issue.code ?? 'UNKNOWN'}:${issue.pointer ?? '-'}:${issue.message ?? ''}`,
        )
        .join(' | ');
      throw new Error(
        `GLB validation failed with ${numErrors} error(s).${detail ? ` ${detail}` : ''}`,
      );
    }
  }

  private hexToRgb(hex: string): [number, number, number] {
    const normalized = hex.replace('#', '');
    const safe =
      normalized.length === 3
        ? normalized
            .split('')
            .map((char) => `${char}${char}`)
            .join('')
        : normalized;
    const value = Number.parseInt(safe, 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    ];
  }

  private isFiniteVec3(point: Vec3): boolean {
    return point.every((value) => Number.isFinite(value));
  }

  private isFiniteVec2(point: [number, number]): boolean {
    return point.every((value) => Number.isFinite(value));
  }

  private samePointXZ(a: Vec3, b: Vec3): boolean {
    return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;
  }
}
