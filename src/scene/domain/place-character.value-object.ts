import type { BuildingData } from '../../places/types/place.types';

export type PlaceCharacterDistrictType =
  | 'ELECTRONICS_DISTRICT'
  | 'SHOPPING_SCRAMBLE'
  | 'OFFICE_DISTRICT'
  | 'RESIDENTIAL'
  | 'TRANSIT_HUB'
  | 'GENERIC';

export type PlaceCharacterSignageDensity = 'DENSE' | 'MODERATE' | 'SPARSE';

export type PlaceCharacterBuildingEra =
  | 'MODERN_POST2000'
  | 'SHOWA_1960_80'
  | 'MIXED';

export type PlaceCharacterFacadeComplexity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PlaceCharacter {
  districtType: PlaceCharacterDistrictType;
  signageDensity: PlaceCharacterSignageDensity;
  buildingEra: PlaceCharacterBuildingEra;
  facadeComplexity: PlaceCharacterFacadeComplexity;
}

/**
 * Google Places primary type → PlaceCharacterDistrictType 매핑 테이블.
 * 아키하바라/시부야 등 전자상가·쇼핑 밀집 지역을 우선 반영.
 */
const GOOGLE_PLACES_DISTRICT_MAP: Record<string, PlaceCharacterDistrictType> = {
  electronics_store: 'ELECTRONICS_DISTRICT',
  home_goods_store: 'ELECTRONICS_DISTRICT',
  appliance_store: 'ELECTRONICS_DISTRICT',
  tourist_attraction: 'SHOPPING_SCRAMBLE',
  shopping_mall: 'SHOPPING_SCRAMBLE',
  department_store: 'SHOPPING_SCRAMBLE',
  clothing_store: 'SHOPPING_SCRAMBLE',
  restaurant: 'SHOPPING_SCRAMBLE',
  cafe: 'SHOPPING_SCRAMBLE',
  corporate_office: 'OFFICE_DISTRICT',
  bank: 'OFFICE_DISTRICT',
  insurance_agency: 'OFFICE_DISTRICT',
  lawyer: 'OFFICE_DISTRICT',
  train_station: 'TRANSIT_HUB',
  subway_station: 'TRANSIT_HUB',
  bus_station: 'TRANSIT_HUB',
  airport: 'TRANSIT_HUB',
  apartment_building: 'RESIDENTIAL',
  residential: 'RESIDENTIAL',
};

/**
 * OSM amenity/shop 태그 → PlaceCharacterDistrictType 매핑 테이블.
 */
const OSM_AMENITY_DISTRICT_MAP: Record<string, PlaceCharacterDistrictType> = {
  electronics: 'ELECTRONICS_DISTRICT',
  computer: 'ELECTRONICS_DISTRICT',
  mobile_phone: 'ELECTRONICS_DISTRICT',
  convenience: 'SHOPPING_SCRAMBLE',
  supermarket: 'SHOPPING_SCRAMBLE',
  restaurant: 'SHOPPING_SCRAMBLE',
  cafe: 'SHOPPING_SCRAMBLE',
  fast_food: 'SHOPPING_SCRAMBLE',
  office: 'OFFICE_DISTRICT',
  bank: 'OFFICE_DISTRICT',
  station: 'TRANSIT_HUB',
  bus_station: 'TRANSIT_HUB',
};

/**
 * OSM landuse 태그 → signageDensity 매핑.
 */
const OSM_LANDUSE_SIGNAGE_MAP: Record<string, PlaceCharacterSignageDensity> = {
  commercial: 'MODERATE',
  retail: 'DENSE',
  mixed: 'MODERATE',
  residential: 'SPARSE',
  industrial: 'SPARSE',
};

/**
 * Google Places types 배열과 OSM 건물 태그를 받아 PlaceCharacter를 도출한다.
 *
 * 매핑 우선순위:
 * 1. Google Places primaryType → districtType
 * 2. OSM shop= 태그 → districtType (electronics 밀도 계산)
 * 3. OSM landuse= 태그 → signageDensity
 * 4. 건물 높이/연도 → buildingEra
 * 5. fallback → GENERIC
 */
export function resolvePlaceCharacter(
  buildings: BuildingData[],
): PlaceCharacter {
  if (buildings.length === 0) {
    return {
      districtType: 'GENERIC',
      signageDensity: 'SPARSE',
      buildingEra: 'MIXED',
      facadeComplexity: 'LOW',
    };
  }

  const districtVotes = new Map<PlaceCharacterDistrictType, number>();
  let electronicsShopCount = 0;
  let totalShopCount = 0;
  let signageDensityVotes = new Map<PlaceCharacterSignageDensity, number>();
  let eraVotes = new Map<PlaceCharacterBuildingEra, number>();
  let complexityVotes = new Map<PlaceCharacterFacadeComplexity, number>();

  for (const building of buildings) {
    // --- Google Places types → districtType ---
    const gp = building.googlePlacesInfo;
    if (gp?.primaryType && GOOGLE_PLACES_DISTRICT_MAP[gp.primaryType]) {
      const district = GOOGLE_PLACES_DISTRICT_MAP[gp.primaryType];
      if (district) {
        districtVotes.set(district, (districtVotes.get(district) ?? 0) + 2);
      }
    }
    if (gp?.types) {
      for (const t of gp.types) {
        const district = GOOGLE_PLACES_DISTRICT_MAP[t];
        if (district) {
          districtVotes.set(district, (districtVotes.get(district) ?? 0) + 1);
        }
      }
    }

    // --- OSM attributes → districtType + signage ---
    const osm = building.osmAttributes ?? {};
    const shopTag = osm['shop'];
    const amenityTag = osm['amenity'];
    const landuseTag = osm['landuse'];
    const buildingTag = osm['building'];

    if (buildingTag === 'retail' || buildingTag === 'commercial') {
      districtVotes.set(
        'SHOPPING_SCRAMBLE',
        (districtVotes.get('SHOPPING_SCRAMBLE') ?? 0) + 1,
      );
    }

    if (shopTag && OSM_AMENITY_DISTRICT_MAP[shopTag]) {
      const district = OSM_AMENITY_DISTRICT_MAP[shopTag];
      districtVotes.set(district, (districtVotes.get(district) ?? 0) + 1.5);
      totalShopCount++;
      if (
        shopTag === 'electronics' ||
        shopTag === 'computer' ||
        shopTag === 'mobile_phone'
      ) {
        electronicsShopCount++;
      }
    }
    if (amenityTag && OSM_AMENITY_DISTRICT_MAP[amenityTag]) {
      const district = OSM_AMENITY_DISTRICT_MAP[amenityTag];
      districtVotes.set(district, (districtVotes.get(district) ?? 0) + 1);
    }
    if (landuseTag && OSM_LANDUSE_SIGNAGE_MAP[landuseTag]) {
      const density = OSM_LANDUSE_SIGNAGE_MAP[landuseTag];
      signageDensityVotes.set(
        density,
        (signageDensityVotes.get(density) ?? 0) + 1,
      );
    }

    // --- buildingEra 추정 ---
    const startYear = osm['start_date'] ?? osm['building:levels'];
    const heightM = building.heightMeters;
    if (startYear && typeof startYear === 'string') {
      const year = parseInt(startYear.slice(0, 4), 10);
      if (!isNaN(year)) {
        if (year >= 2000) {
          eraVotes.set(
            'MODERN_POST2000',
            (eraVotes.get('MODERN_POST2000') ?? 0) + 1,
          );
        } else if (year >= 1960 && year < 1990) {
          eraVotes.set('SHOWA_1960_80', (eraVotes.get('SHOWA_1960_80') ?? 0) + 1);
        } else {
          eraVotes.set('MIXED', (eraVotes.get('MIXED') ?? 0) + 1);
        }
      }
    } else if (heightM >= 30) {
      eraVotes.set(
        'MODERN_POST2000',
        (eraVotes.get('MODERN_POST2000') ?? 0) + 0.5,
      );
    } else if (heightM <= 10) {
      eraVotes.set('SHOWA_1960_80', (eraVotes.get('SHOWA_1960_80') ?? 0) + 0.5);
    }

    // --- facadeComplexity 추정 ---
    const hasHoles = building.holes && building.holes.length > 0;
    const facadeColor = building.facadeColor;
    const facadeMaterial = building.facadeMaterial;
    if (hasHoles || (facadeColor && facadeMaterial)) {
      complexityVotes.set('HIGH', (complexityVotes.get('HIGH') ?? 0) + 1);
    } else if (facadeColor || facadeMaterial) {
      complexityVotes.set('MEDIUM', (complexityVotes.get('MEDIUM') ?? 0) + 1);
    } else {
      complexityVotes.set('LOW', (complexityVotes.get('LOW') ?? 0) + 1);
    }
  }

  // --- districtType 결정 (최다 득표) ---
  const districtType = resolveTopVote(districtVotes) ?? 'GENERIC';

  // --- signageDensity 결정 ---
  // electronics shop 밀도가 높으면 DENSE로 override
  const shopRatio =
    totalShopCount > 0 ? electronicsShopCount / totalShopCount : 0;
  let signageDensity = resolveTopVote(signageDensityVotes) ?? 'MODERATE';
  if (shopRatio > 0.4 || electronicsShopCount >= 3) {
    signageDensity = 'DENSE';
  }

  // --- buildingEra 결정 ---
  const buildingEra = resolveTopVote(eraVotes) ?? 'MIXED';

  // --- facadeComplexity 결정 ---
  const facadeComplexity =
    resolveTopVote(complexityVotes) ?? 'LOW';

  return {
    districtType,
    signageDensity,
    buildingEra,
    facadeComplexity,
  };
}

/**
 * Map에서 가장 높은 득표의 키를 반환. 동점 시 첫 번째 키.
 */
function resolveTopVote<T extends string>(
  votes: Map<T, number>,
): T | undefined {
  let topKey: T | undefined;
  let topScore = -1;
  for (const [key, score] of votes.entries()) {
    if (score > topScore) {
      topKey = key;
      topScore = score;
    }
  }
  return topKey;
}
