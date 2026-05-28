import type { RealityTier } from '../twin-scene-graph';

export type RenderIntent = {
  entityId: string;
  visualMode:
    | 'massing'
    | 'structural_detail'
    | 'landmark_asset'
    | 'traffic_overlay'
    | 'placeholder'
    | 'excluded';
  allowedDetails: {
    windows: boolean;
    entrances: boolean;
    roofEquipment: boolean;
    facadeMaterial: boolean;
    signage: boolean;
  };
  lod: 'L0' | 'L1' | 'L2';
  reasonCodes: string[];
  confidence: number;
};

export type RenderIntentSet = {
  sceneId: string;
  twinSceneGraphId: string;
  intents: RenderIntent[];
  policyVersion: string;
  generatedAt: string;
  tier: {
    initialCandidate: RealityTier;
    provisional: RealityTier;
    reasonCodes: string[];
  };
};

