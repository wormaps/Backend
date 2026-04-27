import type { NormalizedEntityBundle } from '../../../packages/contracts/normalized-entity';
import type { QaIssue } from '../../../packages/contracts/qa';
import type { SceneRelationship } from '../../../packages/contracts/twin-scene-graph';

export class TwinGraphValidationService {
  validate(normalizedBundle: NormalizedEntityBundle, relationships: SceneRelationship[]): QaIssue[] {
    const issues = [...normalizedBundle.issues];

    if (
      issues.some((issue) => issue.code === 'SCENE_DUPLICATED_FOOTPRINT') &&
      !relationships.some((relationship) => relationship.relation === 'duplicates')
    ) {
      issues.push({
        code: 'SCENE_DUPLICATED_FOOTPRINT',
        severity: 'major',
        scope: 'scene',
        message: 'Duplicate footprint issue exists without duplicates relationship.',
        action: 'warn_only',
      });
    }

    if (
      issues.some((issue) => issue.code === 'SCENE_ROAD_BUILDING_OVERLAP') &&
      !relationships.some((relationship) => relationship.relation === 'conflicts')
    ) {
      issues.push({
        code: 'SCENE_ROAD_BUILDING_OVERLAP',
        severity: 'critical',
        scope: 'scene',
        message: 'Road-building overlap exists without conflicts relationship.',
        action: 'fail_build',
      });
    }

    return issues;
  }
}
