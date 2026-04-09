import { createSceneMaterials } from './glb-material-factory.scene';

class FakeMaterial {
  public readonly name: string;
  public baseColorFactor: number[] | null = null;
  public emissiveFactor: number[] | null = null;
  public roughnessFactor: number | null = null;
  public metallicFactor: number | null = null;

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
});
