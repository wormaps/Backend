import { resolveWindowTriangleBudgetForSelection } from './glb-build-building-hero.stage';

describe('glb-build-building-hero.stage', () => {
  describe('resolveWindowTriangleBudgetForSelection', () => {
    it('uses 420k budget up to 700 buildings', () => {
      expect(resolveWindowTriangleBudgetForSelection(699)).toEqual({
        maxWindowTriangles: 420_000,
      });
      expect(resolveWindowTriangleBudgetForSelection(700)).toEqual({
        maxWindowTriangles: 420_000,
      });
    });

    it('uses 360k budget for counts over 700 and up to 1000', () => {
      expect(resolveWindowTriangleBudgetForSelection(701)).toEqual({
        maxWindowTriangles: 360_000,
      });
      expect(resolveWindowTriangleBudgetForSelection(1000)).toEqual({
        maxWindowTriangles: 360_000,
      });
    });

    it('uses 320k budget above 1000 buildings', () => {
      expect(resolveWindowTriangleBudgetForSelection(1001)).toEqual({
        maxWindowTriangles: 320_000,
      });
    });

    it('guards lower bound for empty selection input', () => {
      expect(resolveWindowTriangleBudgetForSelection(0)).toEqual({
        maxWindowTriangles: 420_000,
      });
    });
  });
});
