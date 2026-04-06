import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import {
  createSceneMaterials,
  AccentTone,
  ShellColorBucket,
} from '../compiler/glb-material-factory';
import { GeometryBuffers, Vec3 } from '../compiler/road-mesh.builder';
import {
  appendSceneDiagnosticsLog,
  getSceneDataDir,
} from '../../scene/storage/scene-storage.utils';
import { buildSceneAssetSelection } from '../../scene/utils/scene-asset-profile.utils';
import {
  groupBillboardClustersByColor,
  groupFacadeHintsByPanelColor,
  resolveBuildingShellStyleFromHint,
} from './glb-build-style.utils';
import { addTransportMeshes } from './glb-build-transport.stage';
import { addStreetContextMeshes } from './glb-build-street-context.stage';
import {
  addBuildingAndHeroMeshes,
  buildGroupedBuildingShells,
} from './glb-build-building-hero.stage';
import { GroupedBuildings } from './glb-build-stage.types';
import {
  createBuildingRoofAccentGeometry,
  createCrosswalkGeometry as createCrosswalkGeometryUtil,
  createLandCoverGeometry,
  createLinearFeatureGeometry,
  createPoiGeometry,
  createStreetFurnitureGeometry,
} from './glb-build-local-geometry.utils';
import {
  normalizeLocalRing as normalizeLocalRingUtil,
  signedAreaXZ as signedAreaXZUtil,
  triangulateRings as triangulateRingsUtil,
} from './glb-build-geometry-primitives.utils';
import { Coordinate } from '../../places/types/place.types';
import {
  MaterialClass,
  SceneCrossingDetail,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
} from '../../scene/types/scene.types';

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

    addTransportMeshes(
      {
        addMeshNode: this.addMeshNode.bind(this),
        createCrosswalkGeometry: this.createCrosswalkGeometry.bind(this),
        triangulateRings: triangulateRingsUtil,
      },
      { doc, Accessor, scene, buffer },
      sceneMeta,
      sceneDetail,
      assetSelection,
      materials,
      triangulate,
    );

    addStreetContextMeshes(
      {
        addMeshNode: this.addMeshNode.bind(this),
        createStreetFurnitureGeometry,
        createPoiGeometry,
        createLandCoverGeometry,
        createLinearFeatureGeometry,
      },
      { doc, Accessor, scene, buffer },
      sceneMeta,
      sceneDetail,
      assetSelection,
      materials,
      triangulate,
    );

    const groupedBuildings = buildGroupedBuildingShells(
      {
        buildGroupedBuildingShells: this.buildGroupedBuildingShells.bind(this),
      },
      sceneMeta,
      sceneDetail,
      assetSelection,
    );

    addBuildingAndHeroMeshes(
      {
        addMeshNode: this.addMeshNode.bind(this),
        groupFacadeHintsByPanelColor:
          this.groupFacadeHintsByPanelColor.bind(this),
        groupBillboardClustersByColor:
          this.groupBillboardClustersByColor.bind(this),
        createBuildingRoofAccentGeometry,
      },
      { doc, Accessor, scene, buffer },
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

  private buildGroupedBuildingShells(
    _sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    assetSelection: ReturnType<typeof buildSceneAssetSelection>,
  ): GroupedBuildings {
    const materialHintMap = new Map(
      sceneDetail.facadeHints.map((hint) => [hint.objectId, hint]),
    );

    const groupedBuildings: GroupedBuildings = new Map();
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

  private normalizeLocalRing(ring: Vec3[], direction: 'CW' | 'CCW'): Vec3[] {
    return normalizeLocalRingUtil(ring, direction);
  }

  private signedAreaXZ(points: Vec3[]): number {
    return signedAreaXZUtil(points);
  }

  private createCrosswalkGeometry(
    origin: Coordinate,
    crossings: SceneCrossingDetail[],
  ): GeometryBuffers {
    return createCrosswalkGeometryUtil(origin, crossings);
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
}
