import type {
  PrototypeIdentity,
  PrototypeRegistration,
  PrototypeRegistry,
  PrototypeRegistrySnapshot,
  PrototypeLodVariant,
} from './glb-build-prototype.types';

interface RegistryEntry extends PrototypeRegistration {}

export function createPrototypeRegistry(): PrototypeRegistry {
  const registry = new Map<string, RegistryEntry>();

  return {
    register(identity, objectId, meshName, triangleCount) {
      const existing = registry.get(identity.prototypeKey);
      const lodVariant: PrototypeLodVariant = {
        lodLevel: identity.lodLevel,
        meshName,
        triangleCount,
      };
      if (!existing) {
        registry.set(identity.prototypeKey, {
          identity,
          sourceObjectIds: [objectId],
          lodChain: [lodVariant],
          representativeObjectId: objectId,
        });
        return;
      }

      if (!existing.sourceObjectIds.includes(objectId)) {
        existing.sourceObjectIds.push(objectId);
      }
      existing.lodChain.push(lodVariant);
      registry.set(identity.prototypeKey, existing);
    },
    resolve(prototypeKey) {
      return registry.get(prototypeKey);
    },
    snapshot(): PrototypeRegistrySnapshot {
      const prototypes = [...registry.values()];
      const totalSharedInstances = prototypes.reduce(
        (count, prototype) =>
          count + Math.max(0, prototype.sourceObjectIds.length - 1),
        0,
      );
      const deduplicationSavings = prototypes.reduce((sum, prototype) => {
        const representativeTriangleCount =
          prototype.lodChain[0]?.triangleCount ?? 0;
        return (
          sum +
          representativeTriangleCount *
            Math.max(0, prototype.sourceObjectIds.length - 1)
        );
      }, 0);
      return {
        prototypes,
        totalSharedInstances,
        deduplicationSavings,
      };
    },
  };
}
