import { Injectable } from '@nestjs/common';
import { Coordinate } from '../../../places/types/place.types';
import { midpoint } from '../../../places/utils/geo.utils';
import {
  SceneDetail,
  SceneEvidenceProfile,
  SceneMeta,
  SceneScale,
} from '../../types/scene.types';
import { resolveAssetBudget, resolveAdaptiveAssetBudget } from './asset-budget.utils';
import { ContextProfileService } from './context-profile.service';
import { SceneAssetSelection } from './scene-asset-profile.types';
import { selectSpatialSample } from './scene-asset-selection.utils';
import { VisualArchetypeSelectionService } from './visual-archetype-selection.service';

const SCALE_RADII: Record<SceneScale, { core: number; crossing: number; road: number; walkway: number }> = {
  SMALL: { core: 150, crossing: 160, road: 180, walkway: 170 },
  MEDIUM: { core: 230, crossing: 320, road: 360, walkway: 320 },
  LARGE: { core: 230, crossing: 320, road: 360, walkway: 320 },
};

@Injectable()
export class SceneAssetProfileService {
  constructor(
    private readonly visualArchetype: VisualArchetypeSelectionService,
    private readonly contextProfile: ContextProfileService,
  ) {}

  buildSceneAssetSelection(
    sceneMeta: SceneMeta,
    sceneDetail: SceneDetail,
    scale: SceneScale,
  ): SceneAssetSelection {
    const budget = resolveAdaptiveAssetBudget(
      resolveAssetBudget(scale),
      sceneDetail.fidelityPlan?.targetMode,
      sceneMeta,
    );
    const radii = SCALE_RADII[scale];
    const landmarkLocations = sceneMeta.landmarkAnchors.map(
      (anchor) => anchor.location,
    );

    const buildings = this.visualArchetype.selectBuildings(
      sceneMeta,
      budget.buildingCount,
      radii.core,
    );

    const crossings = this.visualArchetype.selectCrossings(
      sceneDetail.crossings,
      budget.crossingCount,
      sceneMeta,
      landmarkLocations,
      radii.crossing,
      sceneDetail,
    );

    const priorityRoadAnchors = this.uniqueCoordinates([
      sceneMeta.origin,
      ...landmarkLocations,
      ...crossings
        .filter((c) => c.principal)
        .map((c) => c.center),
    ]);

    const roads = this.visualArchetype.selectPathCollection(
      sceneMeta.roads,
      budget.roadCount,
      (r) => r.path,
      (r) => r.center,
      sceneMeta,
      [
        sceneMeta.roads.filter(
          (r) =>
            r.roadClass.includes('primary') ||
            r.roadClass.includes('trunk') ||
            r.widthMeters >= 12,
        ),
      ],
      priorityRoadAnchors,
      radii.road,
    );

    const walkways = this.visualArchetype.selectPathCollection(
      sceneMeta.walkways,
      budget.walkwayCount,
      (w) => w.path,
      (w) => midpoint(w.path) ?? sceneMeta.origin,
      sceneMeta,
      [
        sceneMeta.walkways.filter(
          (w) =>
            this.distanceToOrigin(midpoint(w.path) ?? sceneMeta.origin, sceneMeta.origin) <= radii.walkway,
        ),
        sceneMeta.walkways.filter((w) =>
          crossings.some((c) =>
            w.path.some((p) => this.distanceToOrigin(p, c.center) <= 120),
          ),
        ),
      ],
      priorityRoadAnchors,
      220,
    );

    const pois = this.visualArchetype.selectPois(sceneMeta, budget.poiCount);

    const trafficLights = this.visualArchetype.selectWithSourceFloor(
      sceneDetail.streetFurniture.filter((i) => i.type === 'TRAFFIC_LIGHT'),
      budget.trafficLightCount,
      (i) => i.location,
      sceneMeta,
    );

    const streetLights = this.visualArchetype.selectWithSourceFloor(
      sceneDetail.streetFurniture.filter((i) => i.type === 'STREET_LIGHT'),
      budget.streetLightCount,
      (i) => i.location,
      sceneMeta,
    );

    const signPoles = selectSpatialSample(
      sceneDetail.streetFurniture.filter((i) => i.type === 'SIGN_POLE'),
      budget.signPoleCount,
      (i) => i.location,
      sceneMeta,
    );

    const vegetation = selectSpatialSample(
      sceneDetail.vegetation,
      budget.treeClusterCount,
      (i) => i.location,
      sceneMeta,
    );

    const billboardPanels = selectSpatialSample(
      sceneDetail.signageClusters,
      budget.billboardPanelCount,
      (i) => i.anchor,
      sceneMeta,
    );

    const contextProfile = this.contextProfile.buildContextProfile(
      sceneMeta,
      { buildings, budget },
      sceneDetail,
    );

    return this.contextProfile.composeSelection(buildings, roads, walkways, pois, crossings, trafficLights, streetLights, signPoles, vegetation, billboardPanels, budget, contextProfile.structuralCoverage);
  }

  buildSceneMetaWithAssetSelection(
    sceneMeta: SceneMeta,
    selection: Pick<SceneAssetSelection, 'budget' | 'selected' | 'structuralCoverage'>,
    sceneDetail?: SceneDetail,
  ): SceneMeta {
    return this.contextProfile.buildSceneMetaWithAssetSelection(
      sceneMeta,
      selection,
      sceneDetail,
    );
  }

  buildEvidenceProfile(sceneDetail: SceneDetail): SceneEvidenceProfile {
    return this.contextProfile.buildEvidenceProfile(sceneDetail);
  }

  private uniqueCoordinates(points: Coordinate[]): Coordinate[] {
    const seen = new Set<string>();
    return points.filter((p) => {
      const key = `${p.lat}:${p.lng}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private distanceToOrigin(a: Coordinate, b: Coordinate): number {
    const metersPerLat = 111_320;
    const metersPerLng = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
    return Math.hypot((a.lat - b.lat) * metersPerLat, (a.lng - b.lng) * metersPerLng);
  }
}
