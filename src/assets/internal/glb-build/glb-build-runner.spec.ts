import {
  initializeDccHierarchy,
  registerBuildingGroupNodes,
} from './glb-build-hierarchy';
import type { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  addMeshNode,
  MeshNodeDiagnostic,
  TriangleBudgetState,
} from './glb-build-mesh-node';
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

type LoggerMock = {
  info: jest.Mock<void, [string, Record<string, unknown>?]>;
  warn: jest.Mock<void, [string, Record<string, unknown>?]>;
  error: jest.Mock<void, [string, Record<string, unknown>?]>;
  fromRequest: jest.Mock<{ requestId?: string | null }, [unknown?]>;
};

type RunnerPrivateMethods = {
  optimizeGlbDocument: (
    doc: unknown,
    sceneId: string,
    transformModule: {
      prune: (options?: Record<string, unknown>) => unknown;
      dedup: (options?: Record<string, unknown>) => unknown;
      instance?: (options?: Record<string, unknown>) => unknown;
      simplify?: (options: {
        simplifier: unknown;
        ratio?: number;
        error?: number;
        lockBorder?: boolean;
      }) => unknown;
      weld: (options?: Record<string, unknown>) => unknown;
      quantize: (options?: Record<string, unknown>) => unknown;
    },
    simplifyMeshoptSimplifier?: unknown,
  ) => Promise<void>;
  validateGlb: (
    glbBinary: Uint8Array,
    sceneId: string,
    validatorModule: {
      validateBytes: (
        data: Uint8Array,
        options?: Record<string, unknown>,
      ) => Promise<unknown>;
    },
  ) => Promise<void>;
  enforceSizeBudget: (glbBytes: number, sceneId: string) => void;
};

function createRunnerHarness(): {
  runner: GlbBuildRunner;
  runnerPrivate: RunnerPrivateMethods;
  loggerMock: LoggerMock;
} {
  const loggerMock: LoggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fromRequest: jest.fn(() => ({ requestId: null })),
  };
  const runner = new GlbBuildRunner(loggerMock as unknown as AppLoggerService);
  return {
    runner,
    runnerPrivate: runner as unknown as RunnerPrivateMethods,
    loggerMock,
  };
}

describe('GlbBuildRunner modularized', () => {
  const originalSimplifyEnabled = process.env.GLB_OPTIMIZE_SIMPLIFY_ENABLED;
  const originalSimplifyRatio = process.env.GLB_OPTIMIZE_SIMPLIFY_RATIO;
  const originalSimplifyError = process.env.GLB_OPTIMIZE_SIMPLIFY_ERROR;
  const originalSimplifyLockBorder =
    process.env.GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER;

  beforeEach(() => {
    delete process.env.GLB_OPTIMIZE_SIMPLIFY_ENABLED;
    delete process.env.GLB_OPTIMIZE_SIMPLIFY_RATIO;
    delete process.env.GLB_OPTIMIZE_SIMPLIFY_ERROR;
    delete process.env.GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER;
  });

  afterAll(() => {
    process.env.GLB_OPTIMIZE_SIMPLIFY_ENABLED = originalSimplifyEnabled;
    process.env.GLB_OPTIMIZE_SIMPLIFY_RATIO = originalSimplifyRatio;
    process.env.GLB_OPTIMIZE_SIMPLIFY_ERROR = originalSimplifyError;
    process.env.GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER = originalSimplifyLockBorder;
  });

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
        selectionLod: 'MEDIUM',
        loadTier: 'medium',
        progressiveOrder: 7,
        instanceGroupKey: 'transport:road-base',
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
    expect(mesh.extras.selectionLod).toBe('MEDIUM');
    expect(mesh.extras.loadTier).toBe('medium');
    expect(mesh.extras.progressiveOrder).toBe(7);
    expect(mesh.extras.instanceGroupKey).toBe('transport:road-base');
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
            lodLevel: 'HIGH',
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
    const lodHighGroup = buildingsGroup?.children.find(
      (node) => node.name === 'grp_building_lod_high',
    );
    const buildingNode = lodHighGroup?.children.find(
      (node) => node.name === 'bld_building-1',
    );
    const meshNodeUnderBuilding = buildingNode?.children.find(
      (node) => node.name === 'building_shells_building-1',
    );
    const meshNode = buildingNode?.children.find(
      (node) => node.name === 'building_shells_building-1',
    );

    expect(buildingNode?.extras.twinEntityId).toMatch(/^entity-/);
    expect(meshNode?.extras.twinEntityIds).toEqual([
      buildingNode?.extras.twinEntityId,
    ]);
    expect(meshNodeUnderBuilding?.name).toBe('building_shells_building-1');
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
            lodLevel: 'HIGH',
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
    const lodHighGroup = buildingsGroup?.children.find(
      (node) => node.name === 'grp_building_lod_high',
    );
    const buildingNode = lodHighGroup?.children.find(
      (node) => node.name === 'bld_building-1',
    );

    expect(buildingsGroup?.extras.blenderCollection).toBe('Buildings');
    expect(lodHighGroup?.extras.selectionLod).toBe('HIGH');
    expect(buildingNode?.extras.objectId).toBe('building-1');
    expect(buildingNode?.extras.selectionLod).toBe('HIGH');
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
            lodLevel: 'LOW',
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
    const lodLowGroup = buildingsGroup?.children.find(
      (node) => node.name === 'grp_building_lod_low',
    );
    const buildingNode = lodLowGroup?.children.find(
      (node) => node.name === 'bld_building-hero',
    );
    const directHeroMeshNode = lodLowGroup?.children.find(
      (node) => node.name === 'hero_canopy_building-hero',
    );
    const heroMeshNode = buildingNode?.children.find(
      (node) => node.name === 'hero_canopy_building-hero',
    );

    expect(buildingNode).toBeDefined();
    expect(lodLowGroup).toBeDefined();
    expect(directHeroMeshNode).toBeUndefined();
    expect(heroMeshNode?.extras.semanticCategory).toBe('building');
    expect(heroMeshNode?.extras.sourceObjectIds).toEqual(['building-hero']);
  });

  it('applies minimal GLB optimization transforms and logs result', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest.fn<Promise<void>, unknown[]>().mockResolvedValue();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      instance: jest.fn().mockReturnValue('instance-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await runnerPrivate.optimizeGlbDocument(
      doc,
      'scene-optimize',
      transformModule,
      { mock: 'meshopt' },
    );

    expect(transformModule.prune).toHaveBeenCalledWith(
      expect.objectContaining({
        keepExtras: true,
        keepLeaves: true,
        keepAttributes: true,
      }),
    );
    expect(transformModule.dedup).toHaveBeenCalledWith(
      expect.objectContaining({ keepUniqueNames: true }),
    );
    expect(transformModule.instance).toHaveBeenCalledWith(
      expect.objectContaining({ min: 5 }),
    );
    expect(transformModule.simplify).toHaveBeenCalledWith(
      expect.objectContaining({
        ratio: 0.75,
        error: 0.001,
        lockBorder: false,
      }),
    );
    expect(transformModule.quantize).toHaveBeenCalledWith(
      expect.objectContaining({
        quantizeTexcoord: 12,
        quantizeColor: 8,
        quantizeGeneric: 12,
        cleanup: false,
        pattern: expect.any(RegExp),
      }),
    );
    expect(transform).toHaveBeenCalledWith(
      'prune-step',
      'dedup-step',
      'instance-step',
      'simplify-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'scene.glb_build.optimize',
      expect.objectContaining({
        sceneId: 'scene-optimize',
        step: 'glb_build',
      }),
    );
  });

  it('falls back to non-instance transforms when instance transform fails', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest
      .fn<Promise<void>, unknown[]>()
      .mockRejectedValueOnce(new Error('instance-failed'))
      .mockResolvedValueOnce();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      instance: jest.fn().mockReturnValue('instance-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-instance-fallback',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transform).toHaveBeenNthCalledWith(
      1,
      'prune-step',
      'dedup-step',
      'instance-step',
      'simplify-step',
      'weld-step',
      'quantize-step',
    );
    expect(transform).toHaveBeenNthCalledWith(
      2,
      'prune-step',
      'dedup-step',
      'simplify-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_instance_skipped',
      expect.objectContaining({
        sceneId: 'scene-instance-fallback',
        step: 'glb_build',
        reason: 'instance-failed',
      }),
    );
  });

  it('warns and continues when optimization transform fails', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest
      .fn<Promise<void>, unknown[]>()
      .mockRejectedValue(new Error('transform-failed'));
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-optimize-warn',
        transformModule,
        undefined,
      ),
    ).resolves.toBeUndefined();

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_skipped',
      expect.objectContaining({
        sceneId: 'scene-optimize-warn',
        step: 'glb_build',
        reason: 'transform-failed',
      }),
    );
  });

  it('falls back to non-simplify chain when simplify transform fails', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest
      .fn<Promise<void>, unknown[]>()
      .mockRejectedValueOnce(new Error('simplify-failed'))
      .mockResolvedValueOnce();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-simplify-fallback',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transform).toHaveBeenNthCalledWith(
      1,
      'prune-step',
      'dedup-step',
      'simplify-step',
      'weld-step',
      'quantize-step',
    );
    expect(transform).toHaveBeenNthCalledWith(
      2,
      'prune-step',
      'dedup-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_simplify_skipped',
      expect.objectContaining({
        sceneId: 'scene-simplify-fallback',
        step: 'glb_build',
        reason: 'simplify-failed',
      }),
    );
  });

  it('falls back to base chain when both instance and simplify path fails', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest
      .fn<Promise<void>, unknown[]>()
      .mockRejectedValueOnce(new Error('instance-simplify-failed'))
      .mockRejectedValueOnce(new Error('instance-fallback-simplify-failed'))
      .mockResolvedValueOnce();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      instance: jest.fn().mockReturnValue('instance-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-instance-simplify-double-fallback',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transform).toHaveBeenNthCalledWith(
      1,
      'prune-step',
      'dedup-step',
      'instance-step',
      'simplify-step',
      'weld-step',
      'quantize-step',
    );
    expect(transform).toHaveBeenNthCalledWith(
      2,
      'prune-step',
      'dedup-step',
      'simplify-step',
      'weld-step',
      'quantize-step',
    );
    expect(transform).toHaveBeenNthCalledWith(
      3,
      'prune-step',
      'dedup-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_simplify_skipped',
      expect.objectContaining({
        sceneId: 'scene-instance-simplify-double-fallback',
        triggeredBy: 'instance_fallback',
      }),
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_instance_skipped',
      expect.objectContaining({
        sceneId: 'scene-instance-simplify-double-fallback',
        triggeredBy: 'simplify_fallback',
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'scene.glb_build.optimize',
      expect.objectContaining({
        sceneId: 'scene-instance-simplify-double-fallback',
        fallbackFromInstanceAndSimplify: true,
      }),
    );
  });

  it('skips instance gracefully when instance factory throws before transform', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest.fn<Promise<void>, unknown[]>().mockResolvedValue();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      instance: jest.fn(() => {
        throw new Error('instance-factory-failed');
      }),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-instance-factory-fail',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transform).toHaveBeenCalledWith(
      'prune-step',
      'dedup-step',
      'simplify-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_instance_skipped',
      expect.objectContaining({
        sceneId: 'scene-instance-factory-fail',
        step: 'glb_build',
        reason: 'instance-factory-failed',
        phase: 'instance_factory',
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'scene.glb_build.optimize',
      expect.objectContaining({
        sceneId: 'scene-instance-factory-fail',
        transforms: ['prune', 'dedup', 'simplify', 'weld', 'quantize'],
      }),
    );
  });

  it('skips simplify gracefully when simplify factory throws before transform', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest.fn<Promise<void>, unknown[]>().mockResolvedValue();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      instance: jest.fn().mockReturnValue('instance-step'),
      simplify: jest.fn(() => {
        throw new Error('simplify-factory-failed');
      }),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-simplify-factory-fail',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transform).toHaveBeenCalledWith(
      'prune-step',
      'dedup-step',
      'instance-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_simplify_skipped',
      expect.objectContaining({
        sceneId: 'scene-simplify-factory-fail',
        step: 'glb_build',
        reason: 'simplify-factory-failed',
        phase: 'simplify_factory',
      }),
    );
  });

  it('skips simplify when meshopt simplifier is unavailable', async () => {
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest.fn<Promise<void>, unknown[]>().mockResolvedValue();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-simplify-unavailable',
        transformModule,
        undefined,
      ),
    ).resolves.toBeUndefined();

    expect(transform).toHaveBeenCalledWith(
      'prune-step',
      'dedup-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'scene.glb_build.optimize_simplify_skipped',
      expect.objectContaining({
        sceneId: 'scene-simplify-unavailable',
        reason: 'meshopt_simplifier_unavailable',
        phase: 'simplify_factory',
      }),
    );
  });

  it('disables simplify when env flag is false', async () => {
    process.env.GLB_OPTIMIZE_SIMPLIFY_ENABLED = 'false';
    const { runnerPrivate, loggerMock } = createRunnerHarness();
    const transform = jest.fn<Promise<void>, unknown[]>().mockResolvedValue();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-simplify-disabled-by-env',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transformModule.simplify).not.toHaveBeenCalled();
    expect(transform).toHaveBeenCalledWith(
      'prune-step',
      'dedup-step',
      'weld-step',
      'quantize-step',
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'scene.glb_build.optimize_simplify_disabled',
      expect.objectContaining({
        sceneId: 'scene-simplify-disabled-by-env',
        env: 'GLB_OPTIMIZE_SIMPLIFY_ENABLED',
      }),
    );
  });

  it('applies simplify env overrides with clamped numeric values', async () => {
    process.env.GLB_OPTIMIZE_SIMPLIFY_RATIO = '1.9';
    process.env.GLB_OPTIMIZE_SIMPLIFY_ERROR = '0';
    process.env.GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER = 'true';

    const { runnerPrivate } = createRunnerHarness();
    const transform = jest.fn<Promise<void>, unknown[]>().mockResolvedValue();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-simplify-env-override',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transformModule.simplify).toHaveBeenCalledWith(
      expect.objectContaining({
        ratio: 1,
        error: 0.0001,
        lockBorder: true,
      }),
    );
  });

  it('falls back to defaults on invalid simplify env values', async () => {
    process.env.GLB_OPTIMIZE_SIMPLIFY_ENABLED = 'flase';
    process.env.GLB_OPTIMIZE_SIMPLIFY_RATIO = 'abc';
    process.env.GLB_OPTIMIZE_SIMPLIFY_ERROR = 'not-a-number';
    process.env.GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER = 'maybe';

    const { runnerPrivate } = createRunnerHarness();
    const transform = jest.fn<Promise<void>, unknown[]>().mockResolvedValue();
    const doc = { transform };
    const transformModule = {
      prune: jest.fn().mockReturnValue('prune-step'),
      dedup: jest.fn().mockReturnValue('dedup-step'),
      simplify: jest.fn().mockReturnValue('simplify-step'),
      weld: jest.fn().mockReturnValue('weld-step'),
      quantize: jest.fn().mockReturnValue('quantize-step'),
    };

    await expect(
      runnerPrivate.optimizeGlbDocument(
        doc,
        'scene-simplify-invalid-env',
        transformModule,
        { mock: 'meshopt' },
      ),
    ).resolves.toBeUndefined();

    expect(transformModule.simplify).toHaveBeenCalledWith(
      expect.objectContaining({
        ratio: 0.75,
        error: 0.001,
        lockBorder: false,
      }),
    );
  });

  it('passes strict validator options including format and severity overrides', async () => {
    const { runnerPrivate } = createRunnerHarness();
    const validateBytes = jest.fn().mockResolvedValue({
      issues: {
        numErrors: 0,
        numWarnings: 0,
        numInfos: 0,
        numHints: 0,
        messages: [],
      },
    });

    await expect(
      runnerPrivate.validateGlb(new Uint8Array([1, 2, 3]), 'scene-validate', {
        validateBytes,
      }),
    ).resolves.toBeUndefined();

    expect(validateBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({
        uri: 'scene-validate.glb',
        format: 'glb',
        maxIssues: 0,
        writeTimestamp: false,
      }),
    );
    const validatorOptions = validateBytes.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined;
    const severityOverrides = (validatorOptions?.severityOverrides ?? {}) as
      | Record<string, unknown>
      | undefined;
    expect(severityOverrides?.NON_OBJECT_EXTRAS).toBe(0);
    expect(severityOverrides?.UNDECLARED_EXTENSION).toBe(0);
    expect(severityOverrides?.UNEXPECTED_EXTENSION_OBJECT).toBe(0);
  });

  it('fails when validator report is truncated', async () => {
    const { runnerPrivate } = createRunnerHarness();
    const validateBytes = jest.fn().mockResolvedValue({
      truncated: true,
      issues: {
        numErrors: 0,
        messages: [],
      },
    });

    await expect(
      runnerPrivate.validateGlb(new Uint8Array([7, 8, 9]), 'scene-truncated', {
        validateBytes,
      }),
    ).rejects.toThrow('validation report was truncated');
  });

  it('includes warning summary and issue details when validation fails', async () => {
    const { runnerPrivate } = createRunnerHarness();
    const validateBytes = jest.fn().mockResolvedValue({
      issues: {
        numErrors: 2,
        numWarnings: 3,
        numInfos: 1,
        numHints: 0,
        messages: [
          {
            code: 'NODE_MATRIX_TRS',
            pointer: '/nodes/0',
            message: 'Node has both matrix and TRS',
          },
        ],
      },
    });

    await expect(
      runnerPrivate.validateGlb(new Uint8Array([4, 5, 6]), 'scene-fail', {
        validateBytes,
      }),
    ).rejects.toThrow('warnings=3, infos=1, hints=0');

    await expect(
      runnerPrivate.validateGlb(new Uint8Array([4, 5, 6]), 'scene-fail', {
        validateBytes,
      }),
    ).rejects.toThrow('NODE_MATRIX_TRS:/nodes/0:Node has both matrix and TRS');
  });

  it('throws when GLB size exceeds 30MB budget', () => {
    const { runnerPrivate } = createRunnerHarness();

    expect(() =>
      runnerPrivate.enforceSizeBudget(30 * 1024 * 1024 + 1, 'scene-too-large'),
    ).toThrow('GLB size budget exceeded');
  });

  it('passes when GLB size is within 30MB budget', () => {
    const { runnerPrivate } = createRunnerHarness();

    expect(() =>
      runnerPrivate.enforceSizeBudget(30 * 1024 * 1024, 'scene-fit-budget'),
    ).not.toThrow();
  });
});
