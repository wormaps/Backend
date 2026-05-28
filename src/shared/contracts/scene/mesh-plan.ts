import type { MeshGeometry } from '../../core/geometry';

export type MeshBudget = {
  maxGlbBytes: number;
  maxTriangleCount: number;
  maxNodeCount: number;
  maxMaterialCount: number;
};

export type MeshPlanNode = {
  id: string;
  entityId: string;
  parentId?: string;
  name: string;
  primitive: 'terrain' | 'road' | 'walkway' | 'building_massing' | 'building_windows' | 'poi_marker';
  pivot: { x: number; y: number; z: number };
  materialId: string;
  /** Entity geometry for GLB mesh generation. Falls back to placeholder when undefined. */
  geometry?: MeshGeometry;
};

export type RoadMaterialRole =
  | 'road_motorway'
  | 'road_primary'
  | 'road_secondary'
  | 'road_tertiary'
  | 'road_residential'
  | 'road_service'
  | 'road_footway';

export type MaterialPlan = {
  id: string;
  name: string;
  role: 'terrain' | 'road' | 'building' | 'window' | 'poi' | 'debug' | RoadMaterialRole;
  baseColor?: [number, number, number]; // linear RGB 0–1
};

export type MeshPlan = {
  sceneId: string;
  renderPolicyVersion: string;
  nodes: MeshPlanNode[];
  materials: MaterialPlan[];
  budgets: MeshBudget;
};
