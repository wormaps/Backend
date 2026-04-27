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
  primitive: 'terrain' | 'road' | 'walkway' | 'building_massing' | 'poi_marker';
  pivot: { x: number; y: number; z: number };
  materialId: string;
  /** Entity geometry for GLB mesh generation. Falls back to placeholder when undefined. */
  geometry?: Record<string, unknown>;
};

export type MaterialPlan = {
  id: string;
  name: string;
  role: 'terrain' | 'road' | 'building' | 'poi' | 'debug';
};

export type MeshPlan = {
  sceneId: string;
  renderPolicyVersion: string;
  nodes: MeshPlanNode[];
  materials: MaterialPlan[];
  budgets: MeshBudget;
};

