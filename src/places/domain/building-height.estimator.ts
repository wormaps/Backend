export type EstimationConfidence =
  | 'EXACT'
  | 'LEVELS_BASED'
  | 'CONTEXT_MEDIAN'
  | 'TYPE_DEFAULT';

export const JAPANESE_FLOOR_HEIGHT_METERS = 3.5;

const TYPE_DEFAULT_HEIGHTS: Record<string, number> = {
  skyscraper: 80,
  commercial: 12,
  residential: 9,
  house: 5,
};

export interface HeightEstimate {
  heightMeters: number;
  confidence: EstimationConfidence;
}

export function estimateBuildingHeight(
  tags: Record<string, string> | undefined,
  contextMedian?: number,
): HeightEstimate {
  // 1순위: height= 태그 (미터 직접)
  const explicitHeight = Number.parseFloat(tags?.height ?? '');
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return { heightMeters: explicitHeight, confidence: 'EXACT' };
  }

  // 2순위: building:levels= × 3.5m (일본 건물 층고 기준)
  const levels = Number.parseInt(tags?.['building:levels'] ?? '', 10);
  if (Number.isInteger(levels) && levels > 0) {
    return {
      heightMeters: levels * JAPANESE_FLOOR_HEIGHT_METERS,
      confidence: 'LEVELS_BASED',
    };
  }

  // 3순위: 주변 건물 중앙값 높이 (같은 building:type 클러스터)
  if (contextMedian !== undefined && contextMedian > 0) {
    return { heightMeters: contextMedian, confidence: 'CONTEXT_MEDIAN' };
  }

  // 4순위: building type 기반 기본값
  const buildingType = (tags?.building ?? '').toLowerCase();
  if (buildingType && TYPE_DEFAULT_HEIGHTS[buildingType] !== undefined) {
    return {
      heightMeters: TYPE_DEFAULT_HEIGHTS[buildingType],
      confidence: 'TYPE_DEFAULT',
    };
  }

  // 최종 fallback: commercial 기본값
  return {
    heightMeters: TYPE_DEFAULT_HEIGHTS.commercial,
    confidence: 'TYPE_DEFAULT',
  };
}

export function computeContextMedian(
  buildings: Array<{
    tags?: Record<string, string>;
    heightMeters?: number;
  }>,
  buildingType?: string,
): number | undefined {
  const heights: number[] = [];

  for (const b of buildings) {
    const h = resolveKnownHeight(b.tags);
    if (h !== undefined) {
      if (buildingType) {
        const bType = (b.tags?.building ?? '').toLowerCase();
        if (bType === buildingType.toLowerCase()) {
          heights.push(h);
        }
      } else {
        heights.push(h);
      }
    }
  }

  if (heights.length === 0) {
    return undefined;
  }

  heights.sort((a, b) => a - b);
  const mid = Math.floor(heights.length / 2);
  if (heights.length % 2 === 0) {
    return (heights[mid - 1] + heights[mid]) / 2;
  }
  return heights[mid];
}

function resolveKnownHeight(
  tags: Record<string, string> | undefined,
): number | undefined {
  const explicitHeight = Number.parseFloat(tags?.height ?? '');
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return explicitHeight;
  }

  const levels = Number.parseInt(tags?.['building:levels'] ?? '', 10);
  if (Number.isInteger(levels) && levels > 0) {
    return levels * JAPANESE_FLOOR_HEIGHT_METERS;
  }

  return undefined;
}
