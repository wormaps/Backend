export interface PrototypeIdentity {
  prototypeKey: string;
  semanticCategory: string;
  materialClass: string;
  lodLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PrototypeLodVariant {
  lodLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  meshName: string;
  triangleCount: number;
}

export interface PrototypeRegistration {
  identity: PrototypeIdentity;
  sourceObjectIds: string[];
  lodChain: PrototypeLodVariant[];
  representativeObjectId: string;
}

export interface PrototypeRegistrySnapshot {
  prototypes: PrototypeRegistration[];
  totalSharedInstances: number;
  deduplicationSavings: number;
}

export interface PrototypeRegistry {
  register(
    identity: PrototypeIdentity,
    objectId: string,
    meshName: string,
    triangleCount: number,
  ): void;
  resolve(prototypeKey: string): PrototypeRegistration | undefined;
  snapshot(): PrototypeRegistrySnapshot;
}
