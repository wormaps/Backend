import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { Coordinate } from '../../places/types/place.types';
import {
  createBillboardsGeometry,
  createBuildingPanelsGeometry,
  createBuildingRoofSurfaceGeometry,
  createBuildingShellGeometry,
  createBuildingWindowGeometry,
  createBuildingEntranceGeometry,
  createBuildingRoofEquipmentGeometry,
  createHeroBillboardPlaneGeometry,
  createHeroCanopyGeometry,
  createHeroRoofUnitGeometry,
  createLandmarkExtrasGeometry,
  resolveAccentTone,
} from '../compiler/building-mesh.builder';
import {
  createBillboardMaterial,
  createBuildingPanelMaterial,
  createBuildingShellMaterial,
  createSceneMaterials,
  AccentTone,
  ShellColorBucket,
} from '../compiler/glb-material-factory';
import {
  createCrosswalkGeometry,
  createCurbGeometry,
  createGroundGeometry,
  createMedianGeometry,
  createRoadBaseGeometry,
  createRoadEdgeGeometry,
  createRoadDecalPathGeometry,
  createRoadDecalPolygonGeometry,
  createRoadDecalStripeGeometry,
  createRoadMarkingsGeometry,
  createSidewalkEdgeGeometry,
  createWalkwayGeometry,
  GeometryBuffers,
  mergeGeometryBuffers,
  Vec3,
} from '../compiler/road-mesh.builder';
import {
  createTreeVariationGeometry,
  createBushGeometry,
  createFlowerBedGeometry,
} from '../compiler/vegetation-mesh.builder';
import {
  createBenchGeometry,
  createBikeRackGeometry,
  createTrashCanGeometry,
  createFireHydrantGeometry,
  createEnhancedStreetLightGeometry,
  createEnhancedSignPoleGeometry,
} from '../compiler/street-furniture-mesh.builder';
import {
  appendSceneDiagnosticsLog,
  getSceneDataDir,
} from '../../scene/storage/scene-storage.utils';
import { buildSceneAssetSelection } from '../../scene/utils/scene-asset-profile.utils';
import {
  defaultShellColorForMaterialClass,
  groupBillboardClustersByColor,
  groupFacadeHintsByPanelColor,
  resolveAccentToneFromPalette,
  resolveBuildingAccentToneFromBuilding,
  resolveBuildingShellStyleFromHint,
  resolveMaterialClassFromBuilding,
  resolveShellColorBucketFromColor,
} from './glb-build-style.utils';
import {
  MaterialClass,
  SceneCrossingDetail,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
  SceneStreetFurnitureDetail,
} from '../../scene/types/scene.types';

interface Vec2 {
  x: number;
  z: number;
}

interface MeshNodeDiagnostic {
  name: string;
  vertices: number;
  triangles: number;
  skipped: boolean;
  sourceCount?: number;
  selectedCount?: number;
  skippedReason?: string;
  lodLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  layer?: string;
}

@Injectable()
export class GlbBuildRunner {
  private currentMeshDiagnostics: MeshNodeDiagnostic[] = [];

  constructor(
    private readonly appLoggerService: AppLoggerService = new AppLoggerService(),
  ) {}

  async build(sceneMeta: SceneMeta, sceneDetail: SceneDetail): Promise<string> {
    const gltf = await import('@gltf-transform/core');
    const earcutModule = await import('earcut');
    const validatorModule = await import('gltf-validator');
    const triangulate = earcutModule.default;
    const { Accessor, Document, NodeIO } = gltf;
    const doc = new Document();
    const buffer = doc.createBuffer('scene-buffer');
    const scene = doc.createScene(sceneMeta.sceneId);
    this.currentMeshDiagnostics = [];
    const assetSelection = buildSceneAssetSelection(
      sceneMeta,
      sceneDetail,
      sceneMeta.assetProfile.preset,
    );

    const materials = createSceneMaterials(doc);
    this.addTransportMeshes(
      doc,
      Accessor,
      scene,
      buffer,
      sceneMeta,
      sceneDetail,
      assetSelection,
      materials,
      triangulate,
    );
    this.addStreetContextMeshes(
      doc,
      Accessor,
      scene,
      buffer,
      sceneMeta,
      sceneDetail,
      assetSelection,
      materials,
      triangulate,
    );

    const groupedBuildings = this.buildGroupedBuildingShells(
      sceneMeta,
      sceneDetail,
      assetSelection,
    );
    this.addBuildingAndHeroMeshes(
      doc,
      Accessor,
      scene,
      buffer,
      sceneMeta,
      sceneDetail,
      assetSelection,
      materials,
      triangulate,
      groupedBuildings,
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
    const diagnosticsPayload = {
      assetSelection: {
        selected: assetSelection.selected,
        budget: assetSelection.budget,
      },
      structuralCoverage: sceneMeta.structuralCoverage,
      sourceDetail: {
        crossings: sceneDetail.crossings.length,
        roadMarkings: sceneDetail.roadMarkings.length,
        roadDecals: sceneDetail.roadDecals?.length ?? 0,
        facadeHints: sceneDetail.facadeHints.length,
        signageClusters: sceneDetail.signageClusters.length,
      },
      facadeContextDiagnostics: sceneDetail.facadeContextDiagnostics,
      groupedBuildingShells: [...groupedBuildings.entries()].map(
        ([groupKey, group]) => ({
          groupKey,
          materialClass: group.materialClass,
          bucket: group.bucket,
          colorHex: group.colorHex,
          count: group.buildings.length,
        }),
      ),
      meshNodes: this.currentMeshDiagnostics,
    };
    this.appLoggerService.info('scene.glb_build.diagnostics', {
      sceneId: sceneMeta.sceneId,
      step: 'glb_build',
      ...diagnosticsPayload,
    });
    await appendSceneDiagnosticsLog(
      sceneMeta.sceneId,
      'glb_build',
      diagnosticsPayload,
    );

    return outputPath;
  }

  private resolveBuildingShellStyle(
    building: SceneMeta['buildings'][number],
    hint?: SceneFacadeHint,
  ): {
    key: string;
    materialClass: MaterialClass;
    bucket: ShellColorBucket;
    colorHex: string;
  } {
    return resolveBuildingShellStyleFromHint(building, hint);
  }

  private groupFacadeHintsByPanelColor(
    facadeHints: SceneDetail['facadeHints'],
  ): Array<{
    tone: AccentTone;
    colorHex: string;
    hints: SceneDetail['facadeHints'];
  }> {
    return groupFacadeHintsByPanelColor(facadeHints);
  }

  private groupBillboardClustersByColor(
    selectedClusters: SceneDetail['signageClusters'],
    sourceClusters: SceneDetail['signageClusters'],
  ): Array<{
    tone: AccentTone;
    colorHex: string;
    selectedClusters: SceneDetail['signageClusters'];
    sourceCount: number;
  }> {
    return groupBillboardClustersByColor(selectedClusters, sourceClusters);
  }

  private addTransportMeshes(
    doc: any,
    Accessor: any,
    scene: any,
    buffer: any,
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    assetSelection: ReturnType<typeof buildSceneAssetSelection>,
    materials: ReturnType<typeof createSceneMaterials>,
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
  ): void {
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
      {
        sourceCount: sceneMeta.roads.length,
        selectedCount: assetSelection.roads.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'road_edges',
      createRoadEdgeGeometry(sceneMeta.origin, assetSelection.roads),
      materials.roadEdge,
      {
        sourceCount: sceneMeta.roads.length,
        selectedCount: assetSelection.roads.length,
      },
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
      {
        sourceCount: (sceneDetail.roadDecals ?? []).filter(
          (item) => item.type === 'LANE_OVERLAY' || item.type === 'STOP_LINE',
        ).length,
        selectedCount: (sceneDetail.roadDecals ?? []).filter(
          (item) => item.type === 'LANE_OVERLAY' || item.type === 'STOP_LINE',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'road_markings',
      createRoadMarkingsGeometry(sceneMeta.origin, sceneDetail.roadMarkings),
      materials.roadMarking,
      {
        sourceCount: sceneDetail.roadMarkings.length,
        selectedCount: sceneDetail.roadMarkings.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'crosswalk_overlay',
      mergeGeometryBuffers([
        this.createCrosswalkGeometry(
          sceneMeta.origin,
          assetSelection.crossings,
        ),
        createRoadDecalStripeGeometry(
          sceneMeta.origin,
          sceneDetail.roadDecals ?? [],
          ['CROSSWALK_OVERLAY'],
        ),
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
      {
        sourceCount:
          sceneDetail.crossings.length +
          (sceneDetail.roadDecals ?? []).filter(
            (item) => item.type === 'CROSSWALK_OVERLAY',
          ).length,
        selectedCount:
          assetSelection.crossings.length +
          (sceneDetail.roadDecals ?? []).filter(
            (item) => item.type === 'CROSSWALK_OVERLAY',
          ).length,
      },
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
      {
        sourceCount: (sceneDetail.roadDecals ?? []).filter(
          (item) =>
            item.type === 'JUNCTION_OVERLAY' || item.type === 'ARROW_MARK',
        ).length,
        selectedCount: (sceneDetail.roadDecals ?? []).filter(
          (item) =>
            item.type === 'JUNCTION_OVERLAY' || item.type === 'ARROW_MARK',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'sidewalk',
      createWalkwayGeometry(sceneMeta.origin, assetSelection.walkways),
      materials.sidewalk,
      {
        sourceCount: sceneMeta.walkways.length,
        selectedCount: assetSelection.walkways.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'curbs',
      createCurbGeometry(sceneMeta.origin, assetSelection.roads),
      materials.curb,
      {
        sourceCount: sceneMeta.roads.length,
        selectedCount: assetSelection.roads.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'medians',
      createMedianGeometry(sceneMeta.origin, assetSelection.roads),
      materials.median,
      {
        sourceCount: sceneMeta.roads.filter((road) => road.widthMeters >= 8)
          .length,
        selectedCount: assetSelection.roads.filter(
          (road) => road.widthMeters >= 8,
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'sidewalk_edges',
      createSidewalkEdgeGeometry(sceneMeta.origin, assetSelection.walkways),
      materials.sidewalkEdge,
      {
        sourceCount: sceneMeta.walkways.length,
        selectedCount: assetSelection.walkways.length,
      },
    );
  }

  private addStreetContextMeshes(
    doc: any,
    Accessor: any,
    scene: any,
    buffer: any,
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    assetSelection: ReturnType<typeof buildSceneAssetSelection>,
    materials: ReturnType<typeof createSceneMaterials>,
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
  ): void {
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
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'TRAFFIC_LIGHT',
        ).length,
        selectedCount: assetSelection.trafficLights.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'street_lights',
      createEnhancedStreetLightGeometry(
        sceneMeta.origin,
        assetSelection.streetLights,
      ),
      materials.streetLight,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'STREET_LIGHT',
        ).length,
        selectedCount: assetSelection.streetLights.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'sign_poles',
      createEnhancedSignPoleGeometry(
        sceneMeta.origin,
        assetSelection.signPoles,
      ),
      materials.signPole,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'SIGN_POLE',
        ).length,
        selectedCount: assetSelection.signPoles.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'benches',
      createBenchGeometry(
        sceneMeta.origin,
        sceneDetail.streetFurniture.filter((item) => item.type === 'BENCH'),
      ),
      materials.bench,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'BENCH',
        ).length,
        selectedCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'BENCH',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'bike_racks',
      createBikeRackGeometry(
        sceneMeta.origin,
        sceneDetail.streetFurniture.filter((item) => item.type === 'BIKE_RACK'),
      ),
      materials.bikeRack,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'BIKE_RACK',
        ).length,
        selectedCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'BIKE_RACK',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'trash_cans',
      createTrashCanGeometry(
        sceneMeta.origin,
        sceneDetail.streetFurniture.filter((item) => item.type === 'TRASH_CAN'),
      ),
      materials.trashCan,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'TRASH_CAN',
        ).length,
        selectedCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'TRASH_CAN',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'fire_hydrants',
      createFireHydrantGeometry(
        sceneMeta.origin,
        sceneDetail.streetFurniture.filter(
          (item) => item.type === 'FIRE_HYDRANT',
        ),
      ),
      materials.fireHydrant,
      {
        sourceCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'FIRE_HYDRANT',
        ).length,
        selectedCount: sceneDetail.streetFurniture.filter(
          (item) => item.type === 'FIRE_HYDRANT',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'trees_variation',
      createTreeVariationGeometry(sceneMeta.origin, assetSelection.vegetation),
      materials.treeVariation,
      {
        sourceCount: sceneDetail.vegetation.filter(
          (item) => item.type === 'TREE',
        ).length,
        selectedCount: assetSelection.vegetation.filter(
          (item) => item.type === 'TREE',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'bushes',
      createBushGeometry(sceneMeta.origin, assetSelection.vegetation),
      materials.bush,
      {
        sourceCount: sceneDetail.vegetation.filter(
          (item) => item.type === 'GREEN_PATCH',
        ).length,
        selectedCount: assetSelection.vegetation.filter(
          (item) => item.type === 'GREEN_PATCH',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'flower_beds',
      createFlowerBedGeometry(sceneMeta.origin, assetSelection.vegetation),
      materials.flowerBed,
      {
        sourceCount: sceneDetail.vegetation.filter(
          (item) => item.type === 'PLANTER',
        ).length,
        selectedCount: assetSelection.vegetation.filter(
          (item) => item.type === 'PLANTER',
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'poi_markers',
      this.createPoiGeometry(sceneMeta.origin, assetSelection.pois),
      materials.poi,
      {
        sourceCount: sceneMeta.pois.length,
        selectedCount: assetSelection.pois.length,
      },
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
      {
        sourceCount: sceneDetail.landCovers.filter(
          (item) => item.type === 'PARK',
        ).length,
        selectedCount: sceneDetail.landCovers.filter(
          (item) => item.type === 'PARK',
        ).length,
      },
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
      {
        sourceCount: sceneDetail.landCovers.filter(
          (item) => item.type === 'WATER',
        ).length,
        selectedCount: sceneDetail.landCovers.filter(
          (item) => item.type === 'WATER',
        ).length,
      },
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
      {
        sourceCount: sceneDetail.landCovers.filter(
          (item) => item.type === 'PLAZA',
        ).length,
        selectedCount: sceneDetail.landCovers.filter(
          (item) => item.type === 'PLAZA',
        ).length,
      },
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
      {
        sourceCount: sceneDetail.linearFeatures.filter(
          (item) => item.type === 'RAILWAY',
        ).length,
        selectedCount: sceneDetail.linearFeatures.filter(
          (item) => item.type === 'RAILWAY',
        ).length,
      },
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
      {
        sourceCount: sceneDetail.linearFeatures.filter(
          (item) => item.type === 'BRIDGE',
        ).length,
        selectedCount: sceneDetail.linearFeatures.filter(
          (item) => item.type === 'BRIDGE',
        ).length,
      },
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
      {
        sourceCount: sceneDetail.linearFeatures.filter(
          (item) => item.type === 'WATERWAY',
        ).length,
        selectedCount: sceneDetail.linearFeatures.filter(
          (item) => item.type === 'WATERWAY',
        ).length,
      },
    );
  }

  private buildGroupedBuildingShells(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    assetSelection: ReturnType<typeof buildSceneAssetSelection>,
  ): Map<
    string,
    {
      materialClass: MaterialClass;
      bucket: ShellColorBucket;
      colorHex: string;
      buildings: typeof sceneMeta.buildings;
    }
  > {
    const materialHintMap = new Map(
      sceneDetail.facadeHints.map((hint) => [hint.objectId, hint]),
    );
    const groupedBuildings = new Map<
      string,
      {
        materialClass: MaterialClass;
        bucket: ShellColorBucket;
        colorHex: string;
        buildings: typeof sceneMeta.buildings;
      }
    >();
    for (const building of assetSelection.buildings) {
      const hint = materialHintMap.get(building.objectId);
      const style = this.resolveBuildingShellStyle(building, hint);
      const current = groupedBuildings.get(style.key) ?? {
        materialClass: style.materialClass,
        bucket: style.bucket,
        colorHex: style.colorHex,
        buildings: [],
      };
      current.buildings.push(building);
      groupedBuildings.set(style.key, current);
    }

    return groupedBuildings;
  }

  private addBuildingAndHeroMeshes(
    doc: any,
    Accessor: any,
    scene: any,
    buffer: any,
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    assetSelection: ReturnType<typeof buildSceneAssetSelection>,
    materials: ReturnType<typeof createSceneMaterials>,
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
    groupedBuildings: Map<
      string,
      {
        materialClass: MaterialClass;
        bucket: ShellColorBucket;
        colorHex: string;
        buildings: typeof sceneMeta.buildings;
      }
    >,
  ): void {
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
        createBuildingShellMaterial(
          doc,
          group.materialClass,
          group.bucket,
          group.colorHex,
        ),
        {
          sourceCount: sceneMeta.buildings.length,
          selectedCount: group.buildings.length,
        },
      );
    }
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_roof_surfaces_cool',
      createBuildingRoofSurfaceGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        triangulate,
        'cool',
      ),
      materials.roofSurfaces.cool,
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_roof_surfaces_warm',
      createBuildingRoofSurfaceGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        triangulate,
        'warm',
      ),
      materials.roofSurfaces.warm,
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_roof_surfaces_neutral',
      createBuildingRoofSurfaceGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        triangulate,
        'neutral',
      ),
      materials.roofSurfaces.neutral,
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
    );
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
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
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
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
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
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
    );

    for (const panelGroup of this.groupFacadeHintsByPanelColor(
      sceneDetail.facadeHints,
    )) {
      this.addMeshNode(
        doc,
        Accessor,
        scene,
        buffer,
        `building_panels_${panelGroup.tone}_${panelGroup.colorHex.slice(1)}`,
        createBuildingPanelsGeometry(
          sceneMeta.origin,
          assetSelection.buildings,
          panelGroup.hints,
          panelGroup.tone,
        ),
        createBuildingPanelMaterial(doc, panelGroup.tone, panelGroup.colorHex),
        {
          sourceCount: panelGroup.hints.length,
          selectedCount: assetSelection.buildings.length,
        },
      );
    }

    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_windows',
      createBuildingWindowGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
        sceneDetail.facadeHints,
      ),
      materials.buildingPanels.neutral,
      {
        sourceCount: sceneDetail.facadeHints.length,
        selectedCount: assetSelection.buildings.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_entrances',
      createBuildingEntranceGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
      ),
      materials.buildingPanels.neutral,
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'building_roof_equipment',
      createBuildingRoofEquipmentGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
      ),
      materials.roofAccents.neutral,
      {
        sourceCount: assetSelection.buildings.length,
        selectedCount: assetSelection.buildings.length,
      },
    );

    for (const billboardGroup of this.groupBillboardClustersByColor(
      assetSelection.billboardPanels,
      sceneDetail.signageClusters,
    )) {
      this.addMeshNode(
        doc,
        Accessor,
        scene,
        buffer,
        `billboards_${billboardGroup.tone}_${billboardGroup.colorHex.slice(1)}`,
        createBillboardsGeometry(
          sceneMeta.origin,
          billboardGroup.selectedClusters,
          billboardGroup.tone,
        ),
        createBillboardMaterial(
          doc,
          billboardGroup.tone,
          billboardGroup.colorHex,
        ),
        {
          sourceCount: billboardGroup.sourceCount,
          selectedCount: billboardGroup.selectedClusters.length,
        },
      );
    }
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'hero_canopies',
      createHeroCanopyGeometry(sceneMeta.origin, assetSelection.buildings),
      materials.buildingPanels.neutral,
      {
        sourceCount: assetSelection.buildings.filter(
          (building) => (building.podiumSpec?.canopyEdges.length ?? 0) > 0,
        ).length,
        selectedCount: assetSelection.buildings.filter(
          (building) => (building.podiumSpec?.canopyEdges.length ?? 0) > 0,
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'hero_roof_units',
      createHeroRoofUnitGeometry(sceneMeta.origin, assetSelection.buildings),
      materials.roofAccents.neutral,
      {
        sourceCount: assetSelection.buildings.filter((building) =>
          Boolean(building.roofSpec?.roofUnits),
        ).length,
        selectedCount: assetSelection.buildings.filter((building) =>
          Boolean(building.roofSpec?.roofUnits),
        ).length,
      },
    );
    this.addMeshNode(
      doc,
      Accessor,
      scene,
      buffer,
      'hero_billboard_planes',
      createHeroBillboardPlaneGeometry(
        sceneMeta.origin,
        assetSelection.buildings,
      ),
      materials.billboards.warm,
      {
        sourceCount: assetSelection.buildings.filter(
          (building) => (building.signageSpec?.billboardFaces.length ?? 0) > 0,
        ).length,
        selectedCount: assetSelection.buildings.filter(
          (building) => (building.signageSpec?.billboardFaces.length ?? 0) > 0,
        ).length,
      },
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
      {
        sourceCount:
          sceneMeta.landmarkAnchors.length + sceneDetail.signageClusters.length,
        selectedCount:
          sceneMeta.landmarkAnchors.length + sceneDetail.signageClusters.length,
      },
    );
  }

  private addMeshNode(
    doc: any,
    AccessorRef: any,
    scene: any,
    buffer: any,
    name: string,
    geometry: GeometryBuffers,
    material: any,
    trace: { sourceCount?: number; selectedCount?: number } = {},
  ): void {
    if (!this.isGeometryValid(geometry)) {
      this.currentMeshDiagnostics.push({
        name,
        vertices: 0,
        triangles: 0,
        skipped: true,
        sourceCount: trace.sourceCount,
        selectedCount: trace.selectedCount,
        skippedReason: this.resolveSkippedReason(trace),
      });
      return;
    }

    this.currentMeshDiagnostics.push({
      name,
      vertices: geometry.positions.length / 3,
      triangles: geometry.indices.length / 3,
      skipped: false,
      sourceCount: trace.sourceCount,
      selectedCount: trace.selectedCount,
    });

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

  private resolveSkippedReason(trace: {
    sourceCount?: number;
    selectedCount?: number;
  }): string {
    if ((trace.sourceCount ?? 0) === 0) {
      return 'missing_source';
    }
    if ((trace.selectedCount ?? 0) === 0) {
      return 'selection_cut';
    }
    return 'empty_or_invalid_geometry';
  }

  private createBuildingRoofAccentGeometry(
    origin: Coordinate,
    buildings: SceneMeta['buildings'],
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
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
      const accentTopHeight = Math.min(
        topHeight + 0.18,
        accentBaseHeight + 0.35,
      );
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
      const variant = this.stableVariant(item.objectId, 3);
      if (type === 'TRAFFIC_LIGHT') {
        this.pushTrafficLightAssembly(
          geometry,
          center,
          item.principal,
          variant,
        );
      } else if (type === 'STREET_LIGHT') {
        this.pushStreetLightAssembly(geometry, center, variant);
      } else {
        this.pushSignPoleAssembly(geometry, center, variant);
      }
    }
    return geometry;
  }

  private pushTrafficLightAssembly(
    geometry: GeometryBuffers,
    center: Vec3,
    principal: boolean,
    variant: number,
  ): void {
    const poleHeight = principal ? 7.2 : 6.4;
    const armLength = principal ? 1.8 : 1.2;
    const signalOffset = variant === 0 ? -1 : 1;
    this.pushBox(
      geometry,
      [center[0] - 0.12, 0, center[2] - 0.12],
      [center[0] + 0.12, poleHeight, center[2] + 0.12],
    );
    this.pushBox(
      geometry,
      [center[0] - 0.24, 0, center[2] - 0.24],
      [center[0] + 0.24, 0.16, center[2] + 0.24],
    );
    this.pushBox(
      geometry,
      [center[0], poleHeight - 0.28, center[2] - 0.06],
      [
        center[0] + signalOffset * armLength,
        poleHeight - 0.12,
        center[2] + 0.06,
      ],
    );
    const headX = center[0] + signalOffset * armLength;
    this.pushBox(
      geometry,
      [headX - 0.18, poleHeight - 0.88, center[2] - 0.22],
      [headX + 0.18, poleHeight - 0.18, center[2] + 0.22],
    );
    if (principal) {
      this.pushBox(
        geometry,
        [headX - signalOffset * 0.62, poleHeight - 0.82, center[2] - 0.18],
        [headX - signalOffset * 0.28, poleHeight - 0.28, center[2] + 0.18],
      );
    }
    this.pushBox(
      geometry,
      [center[0] - 0.22, 1.2, center[2] - 0.08],
      [center[0] + 0.16, 1.7, center[2] + 0.08],
    );
  }

  private pushStreetLightAssembly(
    geometry: GeometryBuffers,
    center: Vec3,
    variant: number,
  ): void {
    const poleHeight = variant === 2 ? 9.2 : 8.4;
    const armLength = variant === 1 ? 1.4 : 1.1;
    this.pushBox(
      geometry,
      [center[0] - 0.1, 0, center[2] - 0.1],
      [center[0] + 0.1, poleHeight, center[2] + 0.1],
    );
    this.pushBox(
      geometry,
      [center[0] - 0.2, 0, center[2] - 0.2],
      [center[0] + 0.2, 0.12, center[2] + 0.2],
    );
    this.pushBox(
      geometry,
      [center[0], poleHeight - 0.18, center[2] - 0.05],
      [center[0] + armLength, poleHeight, center[2] + 0.05],
    );
    this.pushBox(
      geometry,
      [center[0] + armLength - 0.18, poleHeight - 0.28, center[2] - 0.18],
      [center[0] + armLength + 0.12, poleHeight + 0.02, center[2] + 0.18],
    );
    if (variant === 2) {
      this.pushBox(
        geometry,
        [center[0] - 0.55, poleHeight - 0.08, center[2] - 0.04],
        [center[0], poleHeight + 0.04, center[2] + 0.04],
      );
    }
  }

  private pushSignPoleAssembly(
    geometry: GeometryBuffers,
    center: Vec3,
    variant: number,
  ): void {
    const poleHeight = 3.4 + variant * 0.35;
    this.pushBox(
      geometry,
      [center[0] - 0.08, 0, center[2] - 0.08],
      [center[0] + 0.08, poleHeight, center[2] + 0.08],
    );
    this.pushBox(
      geometry,
      [center[0] - 0.18, 0, center[2] - 0.18],
      [center[0] + 0.18, 0.08, center[2] + 0.18],
    );
    this.pushBox(
      geometry,
      [center[0] - 0.42, poleHeight - 0.9, center[2] - 0.05],
      [center[0] + 0.42, poleHeight - 0.15, center[2] + 0.05],
    );
    if (variant > 0) {
      this.pushBox(
        geometry,
        [center[0] - 0.28, poleHeight - 1.65, center[2] - 0.05],
        [center[0] + 0.28, poleHeight - 1.1, center[2] + 0.05],
      );
    }
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

  private stableVariant(seed: string, modulo: number): number {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return modulo > 0 ? hash % modulo : 0;
  }

  private createLandCoverGeometry(
    origin: Coordinate,
    covers: SceneDetail['landCovers'],
    type: SceneDetail['landCovers'][number]['type'],
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
  ): GeometryBuffers {
    const geometry = this.createEmptyGeometry();
    const y = type === 'WATER' ? -0.01 : type === 'PLAZA' ? 0.006 : 0.01;

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
      const width = type === 'RAILWAY' ? 3.2 : type === 'BRIDGE' ? 4.6 : 2.8;
      const y = type === 'BRIDGE' ? 0.34 : type === 'WATERWAY' ? -0.005 : 0.025;
      this.pushPathStrips(origin, geometry, feature.path, width, y);
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
      left.push([
        current[0] + normal[0] * half,
        y,
        current[2] + normal[1] * half,
      ]);
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
    this.pushQuad(
      geometry,
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    );
    this.pushQuad(
      geometry,
      [x1, y0, z0],
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
    );
    this.pushQuad(
      geometry,
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    );
    this.pushQuad(
      geometry,
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
    );
    this.pushQuad(
      geometry,
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
      [x0, y1, z0],
    );
    this.pushQuad(
      geometry,
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    );
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

  private normalizeLocalRing(ring: Vec3[], direction: 'CW' | 'CCW'): Vec3[] {
    if (ring.length < 3) {
      return ring;
    }

    const signedArea = this.signedAreaXZ(ring);
    if (Math.abs(signedArea) <= 1e-6) {
      return ring;
    }

    const isClockwise = signedArea < 0;
    if (
      (direction === 'CW' && isClockwise) ||
      (direction === 'CCW' && !isClockwise)
    ) {
      return ring;
    }

    return [...ring].reverse();
  }

  private triangulateRings(
    outerRing: Vec3[],
    holes: Vec3[][],
    triangulate: (
      vertices: number[],
      holes?: number[],
      dimensions?: number,
    ) => number[],
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
      if (
        this.samePointXZ(a, b) ||
        this.samePointXZ(b, c) ||
        this.samePointXZ(a, c)
      ) {
        continue;
      }
      triangles.push([a, b, c]);
    }

    return triangles;
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
      (acc, point) =>
        [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]] as Vec3,
      [0, 0, 0],
    );
    return [total[0] / points.length, 0, total[2] / points.length];
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
      validateBytes: (
        data: Uint8Array,
        options?: Record<string, unknown>,
      ) => Promise<unknown>;
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
    return resolveAccentToneFromPalette(palette);
  }

  private resolveShellColorBucket(
    color: string,
    materialClass: MaterialClass,
  ): ShellColorBucket {
    return resolveShellColorBucketFromColor(color, materialClass);
  }

  private defaultShellColorForMaterialClass(
    materialClass: MaterialClass,
  ): string {
    return defaultShellColorForMaterialClass(materialClass);
  }

  private resolveMaterialClassFromBuilding(
    building: SceneMeta['buildings'][number],
  ): MaterialClass {
    return resolveMaterialClassFromBuilding(building);
  }

  private resolveBuildingAccentTone(
    building: SceneMeta['buildings'][number],
  ): AccentTone {
    return resolveBuildingAccentToneFromBuilding(building);
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
}
