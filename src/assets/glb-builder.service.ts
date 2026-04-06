import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Coordinate } from '../places/types/place.types';
import {
  createBillboardsGeometry,
  createBuildingPanelsGeometry,
  createBuildingShellGeometry,
  createLandmarkExtrasGeometry,
  resolveAccentTone,
} from './compiler/building-mesh.builder';
import {
  createBuildingShellMaterial,
  createSceneMaterials,
  AccentTone,
  ShellColorBucket,
} from './compiler/glb-material-factory';
import {
  createCrosswalkGeometry,
  createGroundGeometry,
  createRoadBaseGeometry,
  createRoadDecalPathGeometry,
  createRoadDecalPolygonGeometry,
  createRoadMarkingsGeometry,
  createWalkwayGeometry,
  GeometryBuffers,
  mergeGeometryBuffers,
  Vec3,
} from './compiler/road-mesh.builder';
import { getSceneDataDir } from '../scene/storage/scene-storage.utils';
import { buildSceneAssetSelection } from '../scene/utils/scene-asset-profile.utils';
import { normalizeColor } from '../scene/utils/scene-building-style.utils';
import {
  FacadePreset,
  GeometryStrategy,
  MaterialClass,
  SceneCrossingDetail,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
  SceneRoadDecal,
  SceneSignageCluster,
  SceneStreetFurnitureDetail,
  SceneVegetationDetail,
  WindowPatternDensity,
} from '../scene/types/scene.types';

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

    const materials = createSceneMaterials(doc);

    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'ground',
      createGroundGeometry(sceneMeta),
      materials.ground,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'road_base',
      createRoadBaseGeometry(sceneMeta.origin, assetSelection.roads),
      materials.roadBase,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'lane_overlay',
      createRoadDecalPathGeometry(
        sceneMeta.origin,
        sceneDetail.roadDecals ?? [],
        ['LANE_OVERLAY', 'STOP_LINE'],
      ),
      materials.laneOverlay,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'road_markings',
      createRoadMarkingsGeometry(sceneMeta.origin, sceneDetail.roadMarkings),
      materials.roadMarking,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'crosswalk_overlay',
      mergeGeometryBuffers([
        createCrosswalkGeometry(sceneMeta.origin, assetSelection.crossings),
        createRoadDecalPathGeometry(
          sceneMeta.origin,
          sceneDetail.roadDecals ?? [],
          ['CROSSWALK_OVERLAY'],
        ),
        createRoadDecalPolygonGeometry(
          sceneMeta.origin,
          sceneDetail.roadDecals ?? [],
          ['CROSSWALK_OVERLAY'],
          this.triangulateRings.bind(this),
          triangulate,
        ),
      ]),
      materials.crosswalk,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'junction_overlay',
      mergeGeometryBuffers([
        createRoadDecalPolygonGeometry(
          sceneMeta.origin,
          sceneDetail.roadDecals ?? [],
          ['JUNCTION_OVERLAY', 'ARROW_MARK'],
          this.triangulateRings.bind(this),
          triangulate,
        ),
      ]),
      materials.junctionOverlay,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'sidewalk',
      createWalkwayGeometry(sceneMeta.origin, assetSelection.walkways),
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
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'poi_markers',
      this.createPoiGeometry(sceneMeta.origin, assetSelection.pois),
      materials.poi,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'landcover_parks',
      this.createLandCoverGeometry(
        sceneMeta.origin,
        sceneDetail.landCovers,
        'PARK',
        triangulate,
      ),
      materials.landCoverPark,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'landcover_water',
      this.createLandCoverGeometry(
        sceneMeta.origin,
        sceneDetail.landCovers,
        'WATER',
        triangulate,
      ),
      materials.landCoverWater,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'landcover_plazas',
      this.createLandCoverGeometry(
        sceneMeta.origin,
        sceneDetail.landCovers,
        'PLAZA',
        triangulate,
      ),
      materials.landCoverPlaza,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'linear_railways',
      this.createLinearFeatureGeometry(
        sceneMeta.origin,
        sceneDetail.linearFeatures,
        'RAILWAY',
      ),
      materials.linearRailway,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'linear_bridges',
      this.createLinearFeatureGeometry(
        sceneMeta.origin,
        sceneDetail.linearFeatures,
        'BRIDGE',
      ),
      materials.linearBridge,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'linear_waterways',
      this.createLinearFeatureGeometry(
        sceneMeta.origin,
        sceneDetail.linearFeatures,
        'WATERWAY',
      ),
      materials.linearWaterway,
    );

    const materialHintMap = new Map(
      sceneDetail.facadeHints.map((hint) => [hint.objectId, hint]),
    );
    const groupedBuildings = new Map<
      string,
      {
        materialClass: MaterialClass;
        bucket: ShellColorBucket;
        buildings: typeof sceneMeta.buildings;
      }
    >();
    for (const building of assetSelection.buildings) {
      const hint = materialHintMap.get(building.objectId);
      const style = this.resolveBuildingShellStyle(building, hint);
      const current = groupedBuildings.get(style.key) ?? {
        materialClass: style.materialClass,
        bucket: style.bucket,
        buildings: [],
      };
      current.buildings.push(building);
      groupedBuildings.set(style.key, current);
    }

    for (const [groupKey, group] of groupedBuildings.entries()) {
      this.addMeshNode(
        doc,
        Accessor,
      scene,
      buffer,
      `building_shells_${groupKey}`,
      createBuildingShellGeometry(
        sceneMeta.origin,
        group.buildings,
        triangulate,
        ),
        createBuildingShellMaterial(doc, group.materialClass, group.bucket),
      );
    }
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_roof_accents_cool',
      this.createBuildingRoofAccentGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        triangulate,
        'cool',
      ),
      materials.roofAccents.cool,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_roof_accents_warm',
      this.createBuildingRoofAccentGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        triangulate,
        'warm',
      ),
      materials.roofAccents.warm,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_roof_accents_neutral',
      this.createBuildingRoofAccentGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        triangulate,
        'neutral',
      ),
      materials.roofAccents.neutral,
    );

    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_panels_cool',
      createBuildingPanelsGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        sceneDetail.facadeHints,
        'cool',
      ),
      materials.buildingPanels.cool,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_panels_warm',
      createBuildingPanelsGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        sceneDetail.facadeHints,
        'warm',
      ),
      materials.buildingPanels.warm,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_panels_neutral',
      createBuildingPanelsGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        sceneDetail.facadeHints,
        'neutral',
      ),
      materials.buildingPanels.neutral,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'billboards_cool',
      createBillboardsGeometry(
        sceneMeta.origin,
        assetSelection.billboardPanels,
        'cool',
      ),
      materials.billboards.cool,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'billboards_warm',
      createBillboardsGeometry(
        sceneMeta.origin,
        assetSelection.billboardPanels,
        'warm',
      ),
      materials.billboards.warm,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'billboards_neutral',
      createBillboardsGeometry(
        sceneMeta.origin,
        assetSelection.billboardPanels,
        'neutral',
      ),
      materials.billboards.neutral,
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'landmark_extras',
      createLandmarkExtrasGeometry(
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
        .setBaseColorFactor([0.82, 0.82, 0.8, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1),
      roadBase: doc
        .createMaterial('road-base')
        .setBaseColorFactor([0.28, 0.29, 0.31, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1),
      roadMarking: doc
        .createMaterial('road-marking')
        .setBaseColorFactor([0.95, 0.94, 0.78, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.68),
      laneOverlay: doc
        .createMaterial('lane-overlay')
        .setBaseColorFactor([0.96, 0.94, 0.72, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.62),
      crosswalk: doc
        .createMaterial('crosswalk')
        .setBaseColorFactor([0.97, 0.97, 0.97, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.82),
      junctionOverlay: doc
        .createMaterial('junction-overlay')
        .setBaseColorFactor([0.94, 0.84, 0.42, 1])
        .setEmissiveFactor([0.08, 0.06, 0.02])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.74),
      sidewalk: doc
        .createMaterial('sidewalk')
        .setBaseColorFactor([0.78, 0.78, 0.76, 1])
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
      poi: doc
        .createMaterial('poi')
        .setBaseColorFactor([0.93, 0.39, 0.18, 1])
        .setEmissiveFactor([0.22, 0.08, 0.03])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.8),
      landCoverPark: doc
        .createMaterial('landcover-park')
        .setBaseColorFactor([0.48, 0.67, 0.38, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1),
      landCoverWater: doc
        .createMaterial('landcover-water')
        .setBaseColorFactor([0.32, 0.55, 0.72, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.4),
      landCoverPlaza: doc
        .createMaterial('landcover-plaza')
        .setBaseColorFactor([0.79, 0.75, 0.66, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.95),
      linearRailway: doc
        .createMaterial('linear-railway')
        .setBaseColorFactor([0.42, 0.42, 0.44, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.85),
      linearBridge: doc
        .createMaterial('linear-bridge')
        .setBaseColorFactor([0.58, 0.58, 0.6, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.82),
      linearWaterway: doc
        .createMaterial('linear-waterway')
        .setBaseColorFactor([0.25, 0.49, 0.68, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.45),
      roofAccents: {
        cool: doc
          .createMaterial('roof-accent-cool')
          .setBaseColorFactor([0.63, 0.8, 0.96, 1])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.58),
        warm: doc
          .createMaterial('roof-accent-warm')
          .setBaseColorFactor([0.94, 0.66, 0.44, 1])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.62),
        neutral: doc
          .createMaterial('roof-accent-neutral')
          .setBaseColorFactor([0.78, 0.8, 0.83, 1])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.6),
      } as Record<AccentTone, any>,
      buildingPanels: {
        cool: doc
          .createMaterial('building-panel-cool')
          .setBaseColorFactor([0.32, 0.48, 0.66, 1])
          .setEmissiveFactor([0.12, 0.18, 0.25])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.72),
        warm: doc
          .createMaterial('building-panel-warm')
          .setBaseColorFactor([0.74, 0.45, 0.26, 1])
          .setEmissiveFactor([0.26, 0.13, 0.06])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.7),
        neutral: doc
          .createMaterial('building-panel-neutral')
          .setBaseColorFactor([0.42, 0.45, 0.5, 1])
          .setEmissiveFactor([0.14, 0.14, 0.16])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.76),
      } as Record<AccentTone, any>,
      billboards: {
        cool: doc
          .createMaterial('billboard-cool')
          .setBaseColorFactor([0.28, 0.63, 0.94, 1])
          .setEmissiveFactor([0.16, 0.32, 0.5])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.68),
        warm: doc
          .createMaterial('billboard-warm')
          .setBaseColorFactor([0.95, 0.36, 0.28, 1])
          .setEmissiveFactor([0.55, 0.18, 0.08])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.7),
        neutral: doc
          .createMaterial('billboard-neutral')
          .setBaseColorFactor([0.85, 0.85, 0.88, 1])
          .setEmissiveFactor([0.28, 0.28, 0.3])
          .setMetallicFactor(0)
          .setRoughnessFactor(0.66),
      } as Record<AccentTone, any>,
      landmark: doc
        .createMaterial('landmark')
        .setBaseColorFactor([0.96, 0.73, 0.18, 1])
        .setEmissiveFactor([0.25, 0.17, 0.05])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.75),
    };
  }

  private createBuildingShellMaterial(
    doc: any,
    materialClass: MaterialClass,
    bucket: ShellColorBucket,
  ) {
    const [r, g, b] = this.hexToRgb(this.resolveShellBucketHex(bucket));
    const surface = this.resolveShellSurface(materialClass);

    return doc
      .createMaterial(`building-shell-${materialClass}-${bucket}`)
      .setBaseColorFactor([r, g, b, 1])
      .setMetallicFactor(surface.metallicFactor)
      .setRoughnessFactor(surface.roughnessFactor);
  }

  private resolveBuildingShellStyle(
    building: SceneMeta['buildings'][number],
    hint?: SceneFacadeHint,
  ): { key: string; materialClass: MaterialClass; bucket: ShellColorBucket } {
    const materialClass =
      hint?.materialClass ?? this.resolveMaterialClassFromBuilding(building);
    const rawColor =
      building.facadeColor ??
      building.roofColor ??
      hint?.palette.find(Boolean) ??
      this.defaultShellColorForMaterialClass(materialClass);
    const normalizedColor = normalizeColor(rawColor);
    const bucket = this.resolveShellColorBucket(normalizedColor, materialClass);

    return {
      key: `${materialClass}_${bucket}`,
      materialClass,
      bucket,
    };
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

  private createBuildingRoofAccentGeometry(
    origin: Coordinate,
    buildings: SceneMeta['buildings'],
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
    tone: AccentTone,
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const building of buildings) {
      if (this.resolveBuildingAccentTone(building) !== tone) {
        continue;
      }

      const outerRing = this.normalizeLocalRing(
        this.toLocalRing(origin, building.outerRing),
        'CCW',
      );
      if (outerRing.length < 3) {
        continue;
      }

      const insetRing = this.insetRing(outerRing, 0.12);
      if (insetRing.length < 3) {
        continue;
      }

      const topHeight = Math.max(4, building.heightMeters);
      const accentBaseHeight =
        building.roofType === 'stepped'
          ? topHeight * 0.82
          : building.roofType === 'gable'
            ? topHeight * 0.78
            : topHeight - Math.min(1.2, Math.max(0.45, topHeight * 0.03));
      const accentTopHeight = Math.min(topHeight + 0.18, accentBaseHeight + 0.35);
      const triangles = this.triangulateRings(insetRing, [], triangulate);
      if (triangles.length === 0) {
        continue;
      }

      for (const [a, b, c] of triangles) {
        this.pushTriangle(
          geometry,
          [a[0], accentTopHeight, a[2]],
          [b[0], accentTopHeight, b[2]],
          [c[0], accentTopHeight, c[2]],
        );
      }
      this.pushRingWallsBetween(
        geometry,
        insetRing,
        accentBaseHeight,
        accentTopHeight,
        false,
      );
    }

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

  private createRoadDecalPathGeometry(
    origin: Coordinate,
    decals: SceneRoadDecal[],
    types: SceneRoadDecal['type'][],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const decal of decals) {
      if (!types.includes(decal.type) || !decal.path || decal.path.length < 2) {
        continue;
      }

      const width =
        decal.type === 'STOP_LINE'
          ? 0.95
          : decal.type === 'CROSSWALK_OVERLAY'
            ? decal.emphasis === 'hero'
              ? 3.6
              : 2.2
            : 0.34;
      const y =
        decal.type === 'STOP_LINE'
          ? 0.036
          : decal.emphasis === 'hero'
            ? 0.05
            : 0.04;
      this.pushPathStrips(origin, geometry, decal.path, width, y);
    }

    return geometry;
  }

  private createRoadDecalPolygonGeometry(
    origin: Coordinate,
    decals: SceneRoadDecal[],
    types: SceneRoadDecal['type'][],
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const decal of decals) {
      if (!types.includes(decal.type) || !decal.polygon || decal.polygon.length < 3) {
        continue;
      }
      const ring = this.normalizeLocalRing(
        this.toLocalRing(origin, decal.polygon),
        'CCW',
      );
      if (ring.length < 3) {
        continue;
      }
      const triangles = this.triangulateRings(ring, [], triangulate);
      const y = decal.type === 'JUNCTION_OVERLAY' ? 0.045 : 0.05;
      for (const [a, b, c] of triangles) {
        this.pushTriangle(
          geometry,
          [a[0], y, a[2]],
          [b[0], y, b[2]],
          [c[0], y, c[2]],
        );
      }
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
      const stripeDepth = 0.8;
      const halfWidth = crossing.principal ? 8 : 5;

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

  private mergeGeometryBuffers(buffers: GeometryBuffers[]): GeometryBuffers {
    const merged = this.createEmptyGeometry();

    for (const buffer of buffers) {
      const baseIndex = merged.positions.length / 3;
      merged.positions.push(...buffer.positions);
      merged.normals.push(...buffer.normals);
      merged.indices.push(...buffer.indices.map((index) => index + baseIndex));
    }

    return merged;
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

  private createPoiGeometry(
    origin: Coordinate,
    pois: SceneMeta['pois'],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const poi of pois) {
      const center = this.toLocalPoint(origin, poi.location);
      if (!this.isFiniteVec3(center)) {
        continue;
      }
      const size = poi.isLandmark ? 0.65 : 0.35;
      const height = poi.isLandmark ? 3.4 : 2;
      this.pushBox(
        geometry,
        [center[0] - 0.08, 0, center[2] - 0.08],
        [center[0] + 0.08, height, center[2] + 0.08],
      );
      this.pushBox(
        geometry,
        [center[0] - size, height, center[2] - size],
        [center[0] + size, height + 0.9, center[2] + size],
      );
    }

    return geometry;
  }

  private createLandCoverGeometry(
    origin: Coordinate,
    covers: SceneDetail['landCovers'],
    type: SceneDetail['landCovers'][number]['type'],
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    const y =
      type === 'WATER' ? -0.01 : type === 'PLAZA' ? 0.006 : 0.01;

    for (const cover of covers) {
      if (cover.type !== type) {
        continue;
      }
      const ring = this.toLocalRing(origin, cover.polygon);
      if (ring.length < 3) {
        continue;
      }
      const triangles = this.triangulateRings(ring, [], triangulate);
      for (const [a, b, c] of triangles) {
        this.pushTriangle(
          geometry,
          [a[0], y, a[2]],
          [b[0], y, b[2]],
          [c[0], y, c[2]],
        );
      }
    }

    return geometry;
  }

  private createLinearFeatureGeometry(
    origin: Coordinate,
    features: SceneDetail['linearFeatures'],
    type: SceneDetail['linearFeatures'][number]['type'],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const feature of features) {
      if (feature.type !== type) {
        continue;
      }
      const width =
        type === 'RAILWAY' ? 3.2 : type === 'BRIDGE' ? 4.6 : 2.8;
      const y =
        type === 'BRIDGE' ? 0.34 : type === 'WATERWAY' ? -0.005 : 0.025;
      this.pushPathStrips(origin, geometry, feature.path, width, y);
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
      const outerRing = this.normalizeLocalRing(
        this.toLocalRing(origin, building.outerRing),
        'CCW',
      );
      const holes = building.holes
        .map((ring) => this.normalizeLocalRing(this.toLocalRing(origin, ring), 'CW'))
        .filter((ring) => ring.length >= 3);
      if (outerRing.length < 3) {
        continue;
      }

      this.pushBuildingByStrategy(
        geometry,
        building,
        outerRing,
        holes,
        triangulate,
      );
    }

    return geometry;
  }

  private pushBuildingByStrategy(
    geometry: GeometryBuffers,
    building: SceneMeta['buildings'][number],
    outerRing: Vec3[],
    holes: Vec3[][],
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ): void {
    const strategy = this.resolveBuildingGeometryStrategy(building, holes, outerRing);
    const height = Math.max(4, building.heightMeters);

    switch (strategy) {
      case 'podium_tower': {
        const podiumHeight = Math.min(
          height * 0.52,
          Math.max(6, (building.podiumLevels ?? 2) * 4),
        );
        this.pushExtrudedPolygon(
          geometry,
          outerRing,
          holes,
          0,
          podiumHeight,
          triangulate,
        );
        const insetRatio = building.cornerChamfer ? 0.2 : 0.14;
        const towerRing = this.insetRing(outerRing, insetRatio);
        if (towerRing.length >= 3) {
          const towerTop = Math.max(podiumHeight + 4, height);
          this.pushExtrudedPolygon(
            geometry,
            towerRing,
            [],
            podiumHeight,
            towerTop,
            triangulate,
          );
        }
        break;
      }
      case 'stepped_tower': {
        const baseTop = Math.max(8, height * 0.58);
        this.pushExtrudedPolygon(
          geometry,
          outerRing,
          holes,
          0,
          baseTop,
          triangulate,
        );
        let currentRing = outerRing;
        const stageCount = Math.max(2, Math.min(3, building.setbackLevels ?? 2));
        for (let stage = 0; stage < stageCount; stage += 1) {
          currentRing = this.insetRing(currentRing, 0.12 + stage * 0.04);
          if (currentRing.length < 3) {
            break;
          }
          const stageMin = baseTop + stage * ((height - baseTop) / stageCount);
          const stageMax =
            stage === stageCount - 1
              ? height
              : baseTop + (stage + 1) * ((height - baseTop) / stageCount);
          this.pushExtrudedPolygon(
            geometry,
            currentRing,
            [],
            stageMin,
            stageMax,
            triangulate,
          );
        }
        break;
      }
      case 'gable_lowrise': {
        const roofBaseHeight = Math.max(3.2, height * 0.72);
        this.pushExtrudedPolygon(
          geometry,
          outerRing,
          holes,
          0,
          roofBaseHeight,
          triangulate,
        );
        this.pushGableRoof(geometry, outerRing, roofBaseHeight, height);
        break;
      }
      case 'courtyard_block': {
        this.pushExtrudedPolygon(
          geometry,
          outerRing,
          holes,
          0,
          height,
          triangulate,
        );
        break;
      }
      case 'fallback_massing': {
        const bounds = this.computeBounds(outerRing);
        this.pushBox(
          geometry,
          [bounds.minX, 0, bounds.minZ],
          [bounds.maxX, height, bounds.maxZ],
        );
        break;
      }
      case 'simple_extrude':
      default: {
        this.pushExtrudedPolygon(
          geometry,
          outerRing,
          holes,
          0,
          height,
          triangulate,
        );
        break;
      }
    }
  }

  private pushExtrudedPolygon(
    geometry: GeometryBuffers,
    outerRing: Vec3[],
    holes: Vec3[][],
    minHeight: number,
    maxHeight: number,
    triangulate: (vertices: number[], holes?: number[], dimensions?: number) => number[],
  ): void {
    const triangulated = this.triangulateRings(outerRing, holes, triangulate);
    if (triangulated.length === 0) {
      return;
    }

    for (const [a, b, c] of triangulated) {
      this.pushTriangle(
        geometry,
        [a[0], maxHeight, a[2]],
        [b[0], maxHeight, b[2]],
        [c[0], maxHeight, c[2]],
      );
      this.pushTriangle(
        geometry,
        [a[0], minHeight, a[2]],
        [c[0], minHeight, c[2]],
        [b[0], minHeight, b[2]],
      );
    }

    this.pushRingWallsBetween(geometry, outerRing, minHeight, maxHeight, false);
    for (const hole of holes) {
      this.pushRingWallsBetween(geometry, hole, minHeight, maxHeight, true);
    }
  }

  private resolveBuildingGeometryStrategy(
    building: SceneMeta['buildings'][number],
    holes: Vec3[][],
    outerRing: Vec3[],
  ): GeometryStrategy {
    if ((building.geometryStrategy ?? 'simple_extrude') === 'fallback_massing') {
      return 'fallback_massing';
    }
    if (holes.length > 0) {
      return 'courtyard_block';
    }
    if (this.isPolygonTooThin(outerRing) || outerRing.length >= 12) {
      return 'fallback_massing';
    }
    return building.geometryStrategy ?? 'simple_extrude';
  }

  private createBuildingPanelsGeometry(
    origin: Coordinate,
    buildings: SceneMeta['buildings'],
    facadeHints: SceneFacadeHint[],
    tone: AccentTone,
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));

    for (const building of buildings) {
      const hint = hintMap.get(building.objectId);
      if (
        !hint ||
        hint.signageDensity === 'low' ||
        this.resolveAccentTone(hint.palette) !== tone
      ) {
        continue;
      }

      const outerRing = this.normalizeLocalRing(
        this.toLocalRing(origin, building.outerRing),
        'CCW',
      );
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

      this.pushFacadePresetPanels(geometry, frame, hint, building.heightMeters);
    }

    return geometry;
  }

  private createBillboardsGeometry(
    origin: Coordinate,
    clusters: SceneSignageCluster[],
    tone: AccentTone,
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();

    for (const cluster of clusters) {
      if (this.resolveAccentTone(cluster.palette) !== tone) {
        continue;
      }
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

  private normalizeLocalRing(
    ring: Vec3[],
    direction: 'CW' | 'CCW',
  ): Vec3[] {
    if (ring.length < 3) {
      return ring;
    }

    const signedArea = this.signedAreaXZ(ring);
    if (Math.abs(signedArea) <= 1e-6) {
      return ring;
    }

    const isClockwise = signedArea < 0;
    if ((direction === 'CW' && isClockwise) || (direction === 'CCW' && !isClockwise)) {
      return ring;
    }

    return [...ring].reverse();
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

  private pushFacadePresetPanels(
    geometry: GeometryBuffers,
    frame: { a: Vec3; b: Vec3; height: number },
    hint: SceneFacadeHint,
    buildingHeight: number,
  ): void {
    const preset = hint.facadePreset ?? 'concrete_repetitive';
    const bandCount = Math.max(1, hint.windowBands);
    const signBandLevels = Math.max(0, hint.signBandLevels ?? 0);
    const glazing = hint.glazingRatio;

    switch (preset) {
      case 'glass_grid':
        this.pushHorizontalBands(geometry, frame, bandCount, 0.42, 0.55);
        this.pushVerticalMullions(
          geometry,
          frame,
          hint.windowPatternDensity ?? 'dense',
          glazing,
        );
        break;
      case 'retail_sign_band':
        this.pushSignBands(geometry, frame, signBandLevels || 2, 1.15);
        this.pushHorizontalBands(geometry, frame, Math.max(2, bandCount - 1), 0.24, 0.58);
        break;
      case 'mall_panel':
        this.pushSignBands(geometry, frame, signBandLevels || 3, 1.4);
        this.pushHorizontalBands(geometry, frame, Math.max(2, Math.floor(bandCount / 2)), 0.8, 0.68);
        if (hint.billboardEligible) {
          this.pushTopBillboardZone(geometry, frame);
        }
        break;
      case 'brick_lowrise':
        this.pushHorizontalBands(geometry, frame, Math.min(3, bandCount), 0.18, 0.44);
        if (signBandLevels > 0) {
          this.pushSignBands(geometry, frame, 1, 0.95);
        }
        break;
      case 'station_metal':
        this.pushHorizontalBands(geometry, frame, Math.max(2, Math.floor(bandCount / 2)), 0.72, 0.62);
        this.pushCanopyBand(geometry, frame, Math.max(3, buildingHeight * 0.16));
        break;
      case 'concrete_repetitive':
      default:
        this.pushHorizontalBands(geometry, frame, bandCount, 0.28, 0.5);
        break;
    }

    if (hint.billboardEligible && preset !== 'mall_panel') {
      this.pushTopBillboardZone(geometry, frame);
    }
  }

  private pushHorizontalBands(
    geometry: GeometryBuffers,
    frame: { a: Vec3; b: Vec3; height: number },
    bandCount: number,
    bandFill: number,
    topCapRatio: number,
  ): void {
    const margin = 0.6;
    const step = Math.max(1.15, (frame.height - margin * 2) / bandCount);
    for (let band = 0; band < bandCount; band += 1) {
      const y0 = Math.min(frame.height - 0.7, margin + band * step);
      const y1 = Math.min(
        frame.height * topCapRatio,
        y0 + Math.min(step * bandFill, 1.05),
      );
      if (y1 <= y0 + 0.08) {
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
  }

  private pushVerticalMullions(
    geometry: GeometryBuffers,
    frame: { a: Vec3; b: Vec3; height: number },
    density: WindowPatternDensity,
    glazingRatio: number,
  ): void {
    const mullionCount =
      density === 'dense' ? 7 : density === 'medium' ? 5 : 3;
    for (let index = 1; index < mullionCount; index += 1) {
      const t = index / mullionCount;
      const x0 = frame.a[0] + (frame.b[0] - frame.a[0]) * t;
      const z0 = frame.a[2] + (frame.b[2] - frame.a[2]) * t;
      const width = Math.max(0.08, 0.16 - glazingRatio * 0.08);
      this.pushQuad(
        geometry,
        [x0 - width, 0.8, z0 - width * 0.2],
        [x0 + width, 0.8, z0 + width * 0.2],
        [x0 + width, frame.height - 0.8, z0 + width * 0.2],
        [x0 - width, frame.height - 0.8, z0 - width * 0.2],
      );
    }
  }

  private pushSignBands(
    geometry: GeometryBuffers,
    frame: { a: Vec3; b: Vec3; height: number },
    levels: number,
    bandHeight: number,
  ): void {
    for (let level = 0; level < levels; level += 1) {
      const y0 = 0.7 + level * (bandHeight + 0.28);
      const y1 = Math.min(frame.height - 0.4, y0 + bandHeight);
      if (y1 <= y0 + 0.08) {
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
  }

  private pushTopBillboardZone(
    geometry: GeometryBuffers,
    frame: { a: Vec3; b: Vec3; height: number },
  ): void {
    const topStart = Math.max(frame.height * 0.58, frame.height - 4.2);
    const topEnd = Math.min(frame.height - 0.35, topStart + 2.8);
    this.pushQuad(
      geometry,
      [frame.a[0], topStart, frame.a[2]],
      [frame.b[0], topStart, frame.b[2]],
      [frame.b[0], topEnd, frame.b[2]],
      [frame.a[0], topEnd, frame.a[2]],
    );
  }

  private pushCanopyBand(
    geometry: GeometryBuffers,
    frame: { a: Vec3; b: Vec3; height: number },
    canopyHeight: number,
  ): void {
    const y0 = Math.min(frame.height - 0.8, 4);
    const y1 = Math.min(frame.height - 0.2, y0 + Math.max(1.2, canopyHeight * 0.18));
    this.pushQuad(
      geometry,
      [frame.a[0], y0, frame.a[2]],
      [frame.b[0], y0, frame.b[2]],
      [frame.b[0], y1, frame.b[2]],
      [frame.a[0], y1, frame.a[2]],
    );
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

  private resolveAccentTone(palette: string[]): AccentTone {
    const sample = palette.find(Boolean);
    if (!sample) {
      return 'neutral';
    }

    const [r, g, b] = this.hexToRgb(sample);
    if (Math.abs(r - b) <= 0.08 && Math.abs(r - g) <= 0.08) {
      return 'neutral';
    }
    if (r >= b + 0.06) {
      return 'warm';
    }
    if (b >= r + 0.06) {
      return 'cool';
    }
    return g > 0.5 ? 'cool' : 'neutral';
  }

  private resolveShellColorBucket(
    color: string,
    materialClass: MaterialClass,
  ): ShellColorBucket {
    if (materialClass === 'brick') {
      return 'brick';
    }

    const [r, g, b] = this.hexToRgb(color);
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const warmDelta = r - Math.max(g, b);
    const coolDelta = b - Math.max(r, g);

    if (coolDelta >= 0.04) {
      return luminance >= 0.7 ? 'cool-light' : 'cool-mid';
    }
    if (warmDelta >= 0.04) {
      return luminance >= 0.66 ? 'warm-light' : 'warm-mid';
    }
    if (luminance >= 0.78) {
      return 'neutral-light';
    }
    if (luminance >= 0.48) {
      return 'neutral-mid';
    }
    return 'neutral-dark';
  }

  private resolveShellBucketHex(bucket: ShellColorBucket): string {
    switch (bucket) {
      case 'cool-light':
        return '#a9c9e8';
      case 'cool-mid':
        return '#6c90b8';
      case 'neutral-light':
        return '#d7dbe0';
      case 'neutral-mid':
        return '#a7afb8';
      case 'neutral-dark':
        return '#707780';
      case 'warm-light':
        return '#d9b59a';
      case 'warm-mid':
        return '#b37a57';
      case 'brick':
      default:
        return '#9f5c45';
    }
  }

  private resolveShellSurface(materialClass: MaterialClass): {
    metallicFactor: number;
    roughnessFactor: number;
  } {
    switch (materialClass) {
      case 'glass':
        return {
          metallicFactor: 0,
          roughnessFactor: 0.68,
        };
      case 'metal':
        return {
          metallicFactor: 0.08,
          roughnessFactor: 0.72,
        };
      default:
        return {
          metallicFactor: 0,
          roughnessFactor: 0.95,
        };
    }
  }

  private defaultShellColorForMaterialClass(materialClass: MaterialClass): string {
    switch (materialClass) {
      case 'glass':
        return '#8eb7d9';
      case 'concrete':
        return '#aab1b8';
      case 'brick':
        return '#a65b42';
      case 'metal':
        return '#8b949d';
      default:
        return '#9ea4aa';
    }
  }

  private resolveMaterialClassFromBuilding(
    building: SceneMeta['buildings'][number],
  ): MaterialClass {
    const rawMaterial = `${building.facadeMaterial ?? ''} ${building.roofMaterial ?? ''}`.toLowerCase();

    if (rawMaterial.includes('glass')) {
      return 'glass';
    }
    if (rawMaterial.includes('brick')) {
      return 'brick';
    }
    if (rawMaterial.includes('metal') || rawMaterial.includes('steel')) {
      return 'metal';
    }
    if (rawMaterial.includes('concrete') || rawMaterial.includes('cement')) {
      return 'concrete';
    }

    switch (building.preset) {
      case 'glass_tower':
        return 'glass';
      case 'mall_block':
      case 'station_block':
        return 'concrete';
      case 'small_lowrise':
        return 'brick';
      default:
        return building.usage === 'COMMERCIAL' ? 'glass' : 'mixed';
    }
  }

  private resolveBuildingAccentTone(
    building: SceneMeta['buildings'][number],
  ): AccentTone {
    const explicit = building.roofColor ?? building.facadeColor;
    if (!explicit) {
      return building.preset === 'glass_tower' ? 'cool' : 'neutral';
    }

    return this.resolveAccentTone([normalizeColor(explicit)]);
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

  private signedAreaXZ(points: Vec3[]): number {
    if (points.length < 3) {
      return 0;
    }

    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      area += current[0] * next[2] - next[0] * current[2];
    }

    return area / 2;
  }

  private isPolygonTooThin(points: Vec3[]): boolean {
    if (points.length < 3) {
      return true;
    }
    const bounds = this.computeBounds(points);
    const minDimension = Math.min(bounds.width, bounds.depth);
    return minDimension <= 1.2;
  }
}
