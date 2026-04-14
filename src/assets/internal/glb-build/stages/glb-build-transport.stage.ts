import {
  createCurbGeometry,
  createGroundGeometry,
  createMedianGeometry,
  createRoadBaseGeometry,
  createRoadDecalPathGeometry,
  createRoadDecalPolygonGeometry,
  createRoadDecalStripeGeometry,
  createRoadEdgeGeometry,
  createRoadMarkingsGeometry,
  createSidewalkEdgeGeometry,
  createWalkwayGeometry,
  mergeGeometryBuffers,
} from '../../../compiler/road';
import {
  AssetSelection,
  MeshAddContext,
  RunnerStageHooks,
  SceneMaterials,
} from '../glb-build-stage.types';
import type { GlbInputContract } from '../glb-build-contract';

export function addTransportMeshes(
  hooks: Pick<
    RunnerStageHooks,
    | 'addMeshNode'
    | 'createCrosswalkGeometry'
    | 'triangulateRings'
    | 'modePolicy'
  >,
  ctx: MeshAddContext,
  sceneMeta: GlbInputContract,
  sceneDetail: GlbInputContract,
  assetSelection: AssetSelection,
  materials: SceneMaterials,
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): void {
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'ground',
    createGroundGeometry(sceneMeta),
    materials.ground,
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'road_base',
    createRoadBaseGeometry(sceneMeta.origin, assetSelection.roads),
    materials.roadBase,
    {
      sourceCount: sceneMeta.roads.length,
      selectedCount: assetSelection.roads.length,
      semanticCategory: 'transport',
      sourceObjectIds: assetSelection.roads.map((road) => road.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'road_edges',
    createRoadEdgeGeometry(sceneMeta.origin, assetSelection.roads),
    materials.roadEdge,
    {
      sourceCount: sceneMeta.roads.length,
      selectedCount: assetSelection.roads.length,
      semanticCategory: 'transport',
      sourceObjectIds: assetSelection.roads.map((road) => road.objectId),
    },
  );
  if (hooks.modePolicy.stage.includeRoadDecal) {
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
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
        semanticCategory: 'transport',
        sourceObjectIds: (sceneDetail.roadDecals ?? [])
          .filter(
            (item) => item.type === 'LANE_OVERLAY' || item.type === 'STOP_LINE',
          )
          .map((item) => item.objectId),
      },
    );
  }
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'road_markings',
    createRoadMarkingsGeometry(sceneMeta.origin, sceneDetail.roadMarkings),
    materials.roadMarking,
    {
      sourceCount: sceneDetail.roadMarkings.length,
      selectedCount: sceneDetail.roadMarkings.length,
      semanticCategory: 'transport',
      sourceObjectIds: sceneDetail.roadMarkings.map((item) => item.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'crosswalk_overlay',
    mergeGeometryBuffers([
      hooks.createCrosswalkGeometry(
        sceneMeta.origin,
        assetSelection.crossings,
        sceneMeta.roads,
      ),
      ...(hooks.modePolicy.stage.includeRoadDecal
        ? [
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
              hooks.triangulateRings,
              triangulate,
            ),
          ]
        : []),
    ]),
    materials.crosswalk,
    {
      sourceCount:
        sceneDetail.crossings.length +
        (hooks.modePolicy.stage.includeRoadDecal
          ? (sceneDetail.roadDecals ?? []).filter(
              (item) => item.type === 'CROSSWALK_OVERLAY',
            ).length
          : 0),
      selectedCount:
        assetSelection.crossings.length +
        (hooks.modePolicy.stage.includeRoadDecal
          ? (sceneDetail.roadDecals ?? []).filter(
              (item) => item.type === 'CROSSWALK_OVERLAY',
            ).length
          : 0),
      semanticCategory: 'transport',
      sourceObjectIds: [
        ...assetSelection.crossings.map((item) => item.objectId),
        ...((sceneDetail.roadDecals ?? [])
          .filter((item) => item.type === 'CROSSWALK_OVERLAY')
          .map((item) => item.objectId) ?? []),
      ],
    },
  );
  if (hooks.modePolicy.stage.includeRoadDecal) {
    hooks.addMeshNode(
      ctx.doc,
      ctx.Accessor,
      ctx.scene,
      ctx.buffer,
      'junction_overlay',
      mergeGeometryBuffers([
        createRoadDecalPolygonGeometry(
          sceneMeta.origin,
          sceneDetail.roadDecals ?? [],
          ['JUNCTION_OVERLAY', 'ARROW_MARK'],
          hooks.triangulateRings,
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
        semanticCategory: 'transport',
        sourceObjectIds: (sceneDetail.roadDecals ?? [])
          .filter(
            (item) =>
              item.type === 'JUNCTION_OVERLAY' || item.type === 'ARROW_MARK',
          )
          .map((item) => item.objectId),
      },
    );
  }
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'sidewalk',
    createWalkwayGeometry(sceneMeta.origin, assetSelection.walkways),
    materials.sidewalk,
    {
      sourceCount: sceneMeta.walkways.length,
      selectedCount: assetSelection.walkways.length,
      semanticCategory: 'transport',
      sourceObjectIds: assetSelection.walkways.map((item) => item.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'curbs',
    createCurbGeometry(sceneMeta.origin, assetSelection.roads),
    materials.curb,
    {
      sourceCount: sceneMeta.roads.length,
      selectedCount: assetSelection.roads.length,
      semanticCategory: 'transport',
      sourceObjectIds: assetSelection.roads.map((road) => road.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'medians',
    createMedianGeometry(sceneMeta.origin, assetSelection.roads),
    materials.greenStrip,
    {
      sourceCount: sceneMeta.roads.filter((road) => road.widthMeters >= 8)
        .length,
      selectedCount: assetSelection.roads.filter(
        (road) => road.widthMeters >= 8,
      ).length,
      semanticCategory: 'transport',
      sourceObjectIds: assetSelection.roads
        .filter((road) => road.widthMeters >= 8)
        .map((road) => road.objectId),
    },
  );
  hooks.addMeshNode(
    ctx.doc,
    ctx.Accessor,
    ctx.scene,
    ctx.buffer,
    'sidewalk_edges',
    createSidewalkEdgeGeometry(sceneMeta.origin, assetSelection.walkways),
    materials.sidewalkEdge,
    {
      sourceCount: sceneMeta.walkways.length,
      selectedCount: assetSelection.walkways.length,
      semanticCategory: 'transport',
      sourceObjectIds: assetSelection.walkways.map((item) => item.objectId),
    },
  );
}
