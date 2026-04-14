import {
  initializeDccHierarchy,
  registerBuildingGroupNodes,
} from './glb-build-hierarchy';
import {
  addMeshNode,
  MeshNodeDiagnostic,
  TriangleBudgetState,
} from './glb-build-mesh-node';

class FakeAccessor {
  static Type = {
    VEC3: 'VEC3',
    SCALAR: 'SCALAR',
  };

  name: string;
  extras: Record<string, unknown> = {};

  constructor(name: string) {
    this.name = name;
  }

  setArray() {
    return this;
  }

  setType() {
    return this;
  }

  setExtras(extras: Record<string, unknown>) {
    this.extras = { ...this.extras, ...extras };
    return this;
  }
}

class FakePrimitive {
  extras: Record<string, unknown> = {};
  material: unknown;

  setAttribute() {
    return this;
  }

  setIndices() {
    return this;
  }

  setMaterial(material: unknown) {
    this.material = material;
    return this;
  }

  setExtras(extras: Record<string, unknown>) {
    this.extras = { ...this.extras, ...extras };
    return this;
  }
}

class FakeMesh {
  name: string;
  extras: Record<string, unknown> = {};
  primitives: FakePrimitive[] = [];

  constructor(name: string) {
    this.name = name;
  }

  addPrimitive(primitive: FakePrimitive) {
    this.primitives.push(primitive);
    return this;
  }

  setExtras(extras: Record<string, unknown>) {
    this.extras = { ...this.extras, ...extras };
    return this;
  }
}

class FakeNode {
  name: string;
  extras: Record<string, unknown> = {};
  mesh: FakeMesh | null = null;
  children: FakeNode[] = [];

  constructor(name: string) {
    this.name = name;
  }

  setMesh(mesh: FakeMesh) {
    this.mesh = mesh;
    return this;
  }

  setExtras(extras: Record<string, unknown>) {
    this.extras = { ...this.extras, ...extras };
    return this;
  }

  addChild(node: FakeNode) {
    this.children.push(node);
    return this;
  }
}

class FakeScene {
  name: string;
  children: FakeNode[] = [];

  constructor(name: string) {
    this.name = name;
  }

  addChild(node: FakeNode) {
    this.children.push(node);
    return this;
  }
}

class FakeDoc {
  meshes: FakeMesh[] = [];
  primitives: FakePrimitive[] = [];
  accessors: FakeAccessor[] = [];

  createMesh(name: string) {
    const mesh = new FakeMesh(name);
    this.meshes.push(mesh);
    return mesh;
  }

  createPrimitive() {
    const primitive = new FakePrimitive();
    this.primitives.push(primitive);
    return primitive;
  }

  createAccessor(name: string) {
    const accessor = new FakeAccessor(name);
    this.accessors.push(accessor);
    return accessor;
  }

  createNode(name: string) {
    return new FakeNode(name);
  }
}

const defaultTriangleBudget: TriangleBudgetState = {
  totalTriangleBudget: 2_500_000,
  totalTriangleCount: 0,
  protectedTriangleCount: 0,
  protectedTriangleReserve: 180_000,
  budgetProtectedMeshNames: new Set<string>([
    'road_base',
    'road_edges',
    'road_markings',
    'lane_overlay',
    'crosswalk_overlay',
    'junction_overlay',
    'building_windows',
    'building_roof_surfaces_cool',
    'building_roof_surfaces_warm',
    'building_roof_surfaces_neutral',
    'building_roof_accents_cool',
    'building_roof_accents_warm',
    'building_roof_accents_neutral',
    'building_entrances',
    'building_roof_equipment',
    'traffic_lights',
    'street_lights',
    'sign_poles',
  ]),
  budgetProtectedMeshPrefixes: ['building_panels_', 'building_shells_'],
};

describe('GlbBuildRunner modularized', () => {
  it('writes semantic provenance extras to node, mesh, and primitive', () => {
    const doc = new FakeDoc();
    const scene = new FakeScene('scene-provenance');
    const material = {};
    const semanticGroupNodes = new Map<string, unknown>();
    const currentMeshDiagnostics: MeshNodeDiagnostic[] = [];
    const triangleBudget = { ...defaultTriangleBudget };

    initializeDccHierarchy(doc, scene, 'scene-provenance', semanticGroupNodes);

    addMeshNode(
      doc,
      FakeAccessor,
      scene,
      {},
      'road_base',
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        indices: [0, 1, 2],
      },
      material,
      {
        sourceCount: 3,
        selectedCount: 2,
        semanticCategory: 'transport',
        sourceObjectIds: ['road-1', 'road-2'],
      },
      currentMeshDiagnostics,
      triangleBudget,
      semanticGroupNodes,
    );

    const root = scene.children[0];
    const group = root.children[0];
    const node = group.children[0];
    const mesh = doc.meshes[0];
    const primitive = doc.primitives[0];

    expect(root.extras.blenderCollection).toBe('Scene');
    expect(group.extras.dccCollection).toBe('Transport');
    expect(node.extras.semanticCategory).toBe('transport');
    expect(mesh.extras.semanticMetadataCoverage).toBe('PARTIAL');
    expect(primitive.extras.sourceObjectIds).toEqual(['road-1', 'road-2']);
    expect((node.extras.twinEntityIds as string[]).length).toBe(2);
    expect(
      (node.extras.twinEntityIds as string[])[0]?.startsWith('entity-'),
    ).toBe(true);
    expect((mesh.extras.sourceSnapshotIds as string[]).length).toBe(2);
    expect(
      (mesh.extras.sourceSnapshotIds as string[])[0]?.startsWith('snapshot-'),
    ).toBe(true);
    expect(node.extras.meshName).toBe('road_base');
  });

  it('attaches twin geometry provenance to building meshes', () => {
    const doc = new FakeDoc();
    const scene = new FakeScene('scene-buildings');
    const semanticGroupNodes = new Map<string, unknown>();
    const currentMeshDiagnostics: MeshNodeDiagnostic[] = [];
    const triangleBudget = { ...defaultTriangleBudget };

    initializeDccHierarchy(doc, scene, 'scene-buildings', semanticGroupNodes);
    registerBuildingGroupNodes(
      doc,
      scene,
      {
        sceneId: 'scene-buildings',
        origin: { lat: 37, lng: 127 },
        buildings: [
          {
            objectId: 'building-1',
            osmWayId: 'way_1',
            usage: 'COMMERCIAL',
            outerRing: [
              { lat: 37.0001, lng: 127.0001 },
              { lat: 37.0001, lng: 127.0002 },
              { lat: 37.0002, lng: 127.0002 },
            ],
            terrainOffsetM: 0.12,
          },
        ],
      } as any,
      semanticGroupNodes,
    );

    addMeshNode(
      doc,
      FakeAccessor,
      scene,
      {},
      'building_shells_building-1',
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        indices: [0, 1, 2],
      },
      {},
      {
        sourceCount: 1,
        selectedCount: 1,
        semanticCategory: 'building',
        sourceObjectIds: ['building-1'],
      },
      currentMeshDiagnostics,
      triangleBudget,
      semanticGroupNodes,
    );

    const root = scene.children[0];
    const buildingsGroup = root.children.find(
      (node) => node.name === 'grp_building',
    );
    const buildingNode = buildingsGroup?.children.find(
      (node) => node.name === 'bld_building-1',
    );
    const meshNode = buildingNode?.children.find(
      (node) => node.name === 'building_shells_building-1',
    );

    expect(buildingNode?.extras.twinEntityId).toMatch(/^entity-/);
    expect(meshNode?.extras.twinEntityIds).toEqual([
      buildingNode?.extras.twinEntityId,
    ]);
    expect(
      (meshNode?.extras.sourceSnapshotIds as string[] | undefined)?.length,
    ).toBeGreaterThan(0);
  });

  it('registers per-building group nodes with pivot metadata for DCC editing', () => {
    const doc = new FakeDoc();
    const scene = new FakeScene('scene-buildings');
    const semanticGroupNodes = new Map<string, unknown>();

    initializeDccHierarchy(doc, scene, 'scene-buildings', semanticGroupNodes);
    registerBuildingGroupNodes(
      doc,
      scene,
      {
        sceneId: 'scene-buildings',
        origin: { lat: 37, lng: 127 },
        buildings: [
          {
            objectId: 'building-1',
            osmWayId: 'way_1',
            usage: 'COMMERCIAL',
            outerRing: [
              { lat: 37.0001, lng: 127.0001 },
              { lat: 37.0001, lng: 127.0002 },
              { lat: 37.0002, lng: 127.0002 },
            ],
            terrainOffsetM: 0.12,
          },
        ],
      } as any,
      semanticGroupNodes,
    );

    const root = scene.children[0];
    const buildingsGroup = root.children.find(
      (node) => node.name === 'grp_building',
    );
    const buildingNode = buildingsGroup?.children.find(
      (node) => node.name === 'bld_building-1',
    );

    expect(buildingsGroup?.extras.blenderCollection).toBe('Buildings');
    expect(buildingNode?.extras.objectId).toBe('building-1');
    expect(buildingNode?.extras.suggestedPivotPolicy).toBe(
      'footprint_centroid',
    );
    expect((buildingNode?.extras.pivotLocal as { y: number }).y).toBe(0.12);
    expect(
      String(buildingNode?.extras.twinEntityId).startsWith('entity-'),
    ).toBe(true);
  });

  it('parents single-building meshes under the matching building group node', () => {
    const doc = new FakeDoc();
    const scene = new FakeScene('scene-building-mesh');
    const semanticGroupNodes = new Map<string, unknown>();
    const currentMeshDiagnostics: MeshNodeDiagnostic[] = [];
    const triangleBudget = { ...defaultTriangleBudget };

    initializeDccHierarchy(
      doc,
      scene,
      'scene-building-mesh',
      semanticGroupNodes,
    );
    registerBuildingGroupNodes(
      doc,
      scene,
      {
        sceneId: 'scene-building-mesh',
        origin: { lat: 37, lng: 127 },
        buildings: [
          {
            objectId: 'building-hero',
            osmWayId: 'way_hero',
            usage: 'COMMERCIAL',
            outerRing: [
              { lat: 37.0001, lng: 127.0001 },
              { lat: 37.0001, lng: 127.0002 },
              { lat: 37.0002, lng: 127.0002 },
            ],
            terrainOffsetM: 0.08,
          },
        ],
      } as any,
      semanticGroupNodes,
    );

    addMeshNode(
      doc,
      FakeAccessor,
      scene,
      {},
      'hero_canopy_building-hero',
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        indices: [0, 1, 2],
      },
      {},
      {
        sourceCount: 1,
        selectedCount: 1,
        semanticCategory: 'building',
        sourceObjectIds: ['building-hero'],
      },
      currentMeshDiagnostics,
      triangleBudget,
      semanticGroupNodes,
    );

    const root = scene.children[0];
    const buildingsGroup = root.children.find(
      (node) => node.name === 'grp_building',
    );
    const buildingNode = buildingsGroup?.children.find(
      (node) => node.name === 'bld_building-hero',
    );
    const heroMeshNode = buildingNode?.children.find(
      (node) => node.name === 'hero_canopy_building-hero',
    );

    expect(buildingNode).toBeDefined();
    expect(heroMeshNode?.extras.semanticCategory).toBe('building');
    expect(heroMeshNode?.extras.sourceObjectIds).toEqual(['building-hero']);
  });
});
