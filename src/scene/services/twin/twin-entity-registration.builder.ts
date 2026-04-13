import type {
  TwinComponent,
  TwinComponentKind,
  TwinEntity,
  TwinEntityKind,
  TwinEvidence,
  TwinProperty,
  TwinPropertyOrigin,
  TwinRelationship,
} from '../../types/scene.types';
import { hashValue, roundConfidence } from './twin-hash.utils';

export interface EntityRegistrationArgs {
  entities: TwinEntity[];
  components: TwinComponent[];
  relationships: TwinRelationship[];
  evidence: TwinEvidence[];
  sceneId: string;
  entityId: string;
  kind: TwinEntityKind;
  objectId: string;
  label: string;
  sourceObjectId: string;
  sourceSnapshotIds: string[];
  parentEntityId?: string;
  evidenceInputs: Array<
    Omit<TwinEvidence, 'evidenceId' | 'entityId' | 'observedAt'>
  >;
  componentSpecs: Array<{
    kind: TwinComponentKind;
    label: string;
    properties: TwinProperty[];
  }>;
}

export function registerEntity(args: EntityRegistrationArgs): void {
  const componentIds: string[] = [];

  args.entities.push({
    entityId: args.entityId,
    objectId: args.objectId,
    kind: args.kind,
    label: args.label,
    sourceObjectId: args.sourceObjectId,
    componentIds,
    tags: [args.kind.toLowerCase()],
  });

  for (const componentSpec of args.componentSpecs) {
    const componentId = `component-${hashValue(
      `${args.entityId}:${componentSpec.kind}:${componentSpec.label}`,
    ).slice(0, 12)}`;
    componentIds.push(componentId);
    args.components.push({
      componentId,
      entityId: args.entityId,
      kind: componentSpec.kind,
      label: componentSpec.label,
      properties: componentSpec.properties,
    });
  }

  if (args.parentEntityId) {
    args.relationships.push({
      relationshipId: `rel-${hashValue(
        `${args.parentEntityId}:${args.entityId}:contains`,
      ).slice(0, 12)}`,
      sourceEntityId: args.parentEntityId,
      targetEntityId: args.entityId,
      type: 'SCENE_CONTAINS',
    });
  }

  args.evidence.push(
    ...args.evidenceInputs.map((item, index) => ({
      evidenceId: `evidence-${hashValue(`${args.entityId}:${index}:${item.summary}`).slice(0, 12)}`,
      entityId: args.entityId,
      kind: item.kind,
      sourceSnapshotId: item.sourceSnapshotId,
      observedAt: new Date().toISOString(),
      confidence: item.confidence,
      provenance: item.provenance,
      summary: item.summary,
      payload: item.payload,
    })),
  );
}

export function createEntityId(sceneId: string, objectId: string): string {
  return `entity-${hashValue(`${sceneId}:${objectId}`).slice(0, 12)}`;
}

export function createProperty(
  entityId: string,
  name: string,
  value: unknown,
  valueType: TwinProperty['valueType'],
  origin: TwinPropertyOrigin,
  confidence: number,
  sourceSnapshotIds: string[],
  evidenceIds: string[] = [],
): TwinProperty {
  return {
    propertyId: `property-${hashValue(`${entityId}:${name}`).slice(0, 12)}`,
    name,
    value,
    valueType,
    origin,
    confidence: roundConfidence(confidence),
    sourceSnapshotIds,
    evidenceIds,
  };
}
