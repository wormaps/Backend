import { resolveSceneModePolicy } from './scene-mode-policy.utils';

describe('scene-mode-policy.utils', () => {
  it('keeps minimal road and furniture details in procedural mode', () => {
    const policy = resolveSceneModePolicy('PROCEDURAL_ONLY');

    expect(policy.id).toBe('procedural_only');
    expect(policy.stage.includeRoadDecal).toBe(true);
    expect(policy.stage.includeMinorFurniture).toBe(true);
  });
});
