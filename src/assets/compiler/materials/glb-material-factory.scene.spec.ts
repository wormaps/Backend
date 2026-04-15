import {
  createBuildingShellMaterial,
  createSceneMaterials,
} from './glb-material-factory.scene';

class FakeMaterial {
  public readonly name: string;
  public baseColorFactor: number[] | null = null;
  public emissiveFactor: number[] | null = null;
  public roughnessFactor: number | null = null;
  public metallicFactor: number | null = null;
  public alphaMode: 'OPAQUE' | 'MASK' | 'BLEND' | null = null;
  public alphaCutoff: number | null = null;
  public doubleSided: boolean | null = null;
  public extras: Record<string, unknown> = {};
  public baseColorTexture: unknown = null;

  constructor(name: string) {
    this.name = name;
  }

  setBaseColorFactor(value: number[]) {
    this.baseColorFactor = value;
    return this;
  }

  setEmissiveFactor(value: number[]) {
    this.emissiveFactor = value;
    return this;
  }

  setRoughnessFactor(value: number) {
    this.roughnessFactor = value;
    return this;
  }

  setMetallicFactor(value: number) {
    this.metallicFactor = value;
    return this;
  }

  setDoubleSided() {
    this.doubleSided = true;
    return this;
  }

  setAlphaMode(value: 'OPAQUE' | 'MASK' | 'BLEND') {
    this.alphaMode = value;
    return this;
  }

  setAlphaCutoff(value: number) {
    this.alphaCutoff = value;
    return this;
  }

  setExtra(key: string, value: Record<string, unknown>) {
    this.extras[key] = value;
    return this;
  }

  setExtras(value: Record<string, unknown>) {
    this.extras = { ...this.extras, ...value };
    return this;
  }

  setBaseColorTexture(texture: unknown) {
    this.baseColorTexture = texture;
    return this;
  }
}

class FakeDoc {
  createMaterial(name: string) {
    return new FakeMaterial(name);
  }
}

describe('glb-material-factory.scene', () => {
  it('keeps crosswalk/lane/junction overlays legible under wet-road tuning', () => {
    const materials = createSceneMaterials(new FakeDoc(), {
      roadRoughnessScale: 1,
      wetRoadBoost: 0.7,
      emissiveBoost: 1.2,
    });

    const roadBase = materials.roadBase as FakeMaterial;
    const crosswalk = materials.crosswalk as FakeMaterial;
    const laneOverlay = materials.laneOverlay as FakeMaterial;
    const junctionOverlay = materials.junctionOverlay as FakeMaterial;

    expect(roadBase.baseColorFactor?.[0]).toBeLessThan(
      (crosswalk.baseColorFactor?.[0] ?? 0) - 0.75,
    );
    expect(crosswalk.roughnessFactor).toBeGreaterThan(
      roadBase.roughnessFactor!,
    );
    expect(laneOverlay.roughnessFactor).toBeGreaterThan(
      roadBase.roughnessFactor!,
    );
    expect(junctionOverlay.roughnessFactor).toBeGreaterThan(
      roadBase.roughnessFactor!,
    );
    expect(crosswalk.emissiveFactor?.[0] ?? 0).toBeGreaterThan(0.2);
    expect(laneOverlay.emissiveFactor?.[0] ?? 0).toBeGreaterThan(0.15);
    expect(junctionOverlay.emissiveFactor?.[0] ?? 0).toBeGreaterThan(0.2);
  });

  describe('texture path behavior', () => {
    it('uses fallback path when enableTexturePath is false (default)', () => {
      const materials = createSceneMaterials(new FakeDoc());

      expect(materials.textureDiagnostics).toBeDefined();
      expect(materials.textureDiagnostics?.texturePathActive).toBe(false);
      expect(materials.textureDiagnostics?.fallbackPathActive).toBe(true);
      expect(materials.textureDiagnostics?.reason).toBe(
        'enableTexturePath is false',
      );

      const ground = materials.ground as FakeMaterial;
      expect(ground.baseColorTexture).toBeNull();
    });

    it('uses fallback path when enableTexturePath is true but no texture slots provided', () => {
      const materials = createSceneMaterials(new FakeDoc(), {
        enableTexturePath: true,
      });

      expect(materials.textureDiagnostics).toBeDefined();
      expect(materials.textureDiagnostics?.texturePathActive).toBe(false);
      expect(materials.textureDiagnostics?.fallbackPathActive).toBe(true);
      expect(materials.textureDiagnostics?.reason).toBe(
        'No texture slots provided',
      );

      const ground = materials.ground as FakeMaterial;
      expect(ground.baseColorTexture).toBeNull();
    });

    it('uses texture path when enableTexturePath is true and texture slots are provided', () => {
      const groundTexture = { uri: 'ground.png', mimeType: 'image/png' };
      const roadTexture = { uri: 'road.png', mimeType: 'image/png' };

      const materials = createSceneMaterials(new FakeDoc(), {
        enableTexturePath: true,
        textureSlots: {
          ground: groundTexture,
          roadBase: roadTexture,
        },
      });

      expect(materials.textureDiagnostics).toBeDefined();
      expect(materials.textureDiagnostics?.texturePathActive).toBe(true);
      expect(materials.textureDiagnostics?.fallbackPathActive).toBe(false);
      expect(materials.textureDiagnostics?.textureSlotUsed).toBe(
        'ground, roadBase',
      );
      expect(materials.textureDiagnostics?.reason).toBe(
        'Texture path active for: ground, roadBase',
      );

      const ground = materials.ground as FakeMaterial;
      expect(ground.baseColorTexture).toEqual(groundTexture);

      const roadBase = materials.roadBase as FakeMaterial;
      expect(roadBase.baseColorTexture).toEqual(roadTexture);

      const sidewalk = materials.sidewalk as FakeMaterial;
      expect(sidewalk.baseColorTexture).toBeNull();
    });

    it('preserves color factor fallback when texture is not available', () => {
      const materials = createSceneMaterials(new FakeDoc(), {
        enableTexturePath: true,
        textureSlots: {
          ground: { uri: 'ground.png' },
        },
      });

      const ground = materials.ground as FakeMaterial;
      expect(ground.baseColorFactor).toEqual([0.52, 0.55, 0.5, 1]);
      expect(ground.baseColorTexture).toEqual({ uri: 'ground.png' });

      const roadBase = materials.roadBase as FakeMaterial;
      expect(roadBase.baseColorFactor).toEqual([0.14, 0.15, 0.17, 1]);
      expect(roadBase.baseColorTexture).toBeNull();
    });

    it('applies building shell texture slot when texture path is enabled', () => {
      const buildingShellTexture = { uri: 'building-shell.png' };
      const shell = createBuildingShellMaterial(
        new FakeDoc(),
        'glass',
        'cool-light',
        undefined,
        {
          enableTexturePath: true,
          textureSlots: {
            buildingShell: buildingShellTexture,
          },
        },
      ) as FakeMaterial;

      expect(shell.baseColorTexture).toEqual(buildingShellTexture);
    });
  });
});
