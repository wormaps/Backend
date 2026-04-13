import { GlbBuildRunner } from './glb-build-runner';

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

describe('GlbBuildRunner', () => {
  it('writes semantic provenance extras to node, mesh, and primitive', () => {
    const runner = new GlbBuildRunner() as any;
    const doc = new FakeDoc();
    const scene = new FakeScene('scene-provenance');
    const material = {};

    runner.initializeDccHierarchy(doc, scene, 'scene-provenance');

    runner.addMeshNode(
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
    expect((node.extras.twinEntityIds as string[])[0]?.startsWith('entity-')).toBe(
      true,
    );
    expect((mesh.extras.sourceSnapshotIds as string[]).length).toBe(2);
    expect(
      (mesh.extras.sourceSnapshotIds as string[])[0]?.startsWith('snapshot-'),
    ).toBe(true);
    expect(node.extras.meshName).toBe('road_base');
  });

  it('registers per-building group nodes with pivot metadata for DCC editing', () => {
    const runner = new GlbBuildRunner() as any;
    const doc = new FakeDoc();
    const scene = new FakeScene('scene-buildings');

    runner.initializeDccHierarchy(doc, scene, 'scene-buildings');
    runner.registerBuildingGroupNodes(doc, scene, {
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
    });

    const root = scene.children[0];
    const buildingsGroup = root.children.find((node) => node.name === 'grp_building');
    const buildingNode = buildingsGroup?.children.find(
      (node) => node.name === 'bld_building-1',
    );

    expect(buildingsGroup?.extras.blenderCollection).toBe('Buildings');
    expect(buildingNode?.extras.objectId).toBe('building-1');
    expect(buildingNode?.extras.suggestedPivotPolicy).toBe('footprint_centroid');
    expect((buildingNode?.extras.pivotLocal as { y: number }).y).toBe(0.12);
    expect(
      String(buildingNode?.extras.twinEntityId).startsWith('entity-'),
    ).toBe(true);
  });

  it('parents single-building meshes under the matching building group node', () => {
    const runner = new GlbBuildRunner() as any;
    const doc = new FakeDoc();
    const scene = new FakeScene('scene-building-mesh');

    runner.initializeDccHierarchy(doc, scene, 'scene-building-mesh');
    runner.registerBuildingGroupNodes(doc, scene, {
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
    });

    runner.addMeshNode(
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
    );

    const root = scene.children[0];
    const buildingsGroup = root.children.find((node) => node.name === 'grp_building');
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
