import type { Coordinate } from '../../places/types/place.types';
import type { Vec3 } from '../../assets/compiler/road/road-mesh.types';

/**
 * 지리 좌표(Coordinate)를 원점(origin) 기준 로컬 3D 좌표(Vec3)로 변환.
 * - X: 동서 방향 (m)
 * - Y: 고도 (0 고정)
 * - Z: 남북 방향 (m, 북쪽이 음수)
 */
export function toLocalPoint(origin: Coordinate, point: Coordinate): Vec3 {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const x = (point.lng - origin.lng) * metersPerLng;
  const z = -(point.lat - origin.lat) * metersPerLat;
  return [x, 0, z];
}

/**
 * 좌표 배열(ring)을 원점 기준 로컬 3D 좌표 배열로 변환.
 * 중복 정점 제거 + 시작/끝 정점 일치 시 pop 처리 포함.
 */
export function toLocalRing(origin: Coordinate, points: Coordinate[]): Vec3[] {
  const deduped = points.filter((point, index) => {
    const prev = points[index - 1];
    return !prev || prev.lat !== point.lat || prev.lng !== point.lng;
  });
  const normalized = [...deduped];
  if (normalized.length > 1) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) {
      normalized.pop();
    }
  }

  return normalized
    .map((point) => toLocalPoint(origin, point))
    .filter((point) => isFiniteVec3(point));
}

/**
 * 링의 방향(CW/CCW)을 기준으로 방향을 정규화.
 * 방향이 다르면 reverse.
 */
export function normalizeLocalRing(
  ring: Vec3[],
  direction: 'CW' | 'CCW',
): Vec3[] {
  if (ring.length < 3) {
    return ring;
  }

  const signedArea = signedAreaXZ(ring);
  if (Math.abs(signedArea) <= 1e-6) {
    return ring;
  }

  const isClockwise = signedArea < 0;
  if (
    (direction === 'CW' && isClockwise) ||
    (direction === 'CCW' && !isClockwise)
  ) {
    return ring;
  }

  return [...ring].reverse();
}

/** Vec3의 모든 성분이 유한한지 확인. */
export function isFiniteVec3(vector: Vec3): boolean {
  return (
    Number.isFinite(vector[0]) &&
    Number.isFinite(vector[1]) &&
    Number.isFinite(vector[2])
  );
}

/** XZ 평면에서 두 Vec3가 동일한지 확인 (tolerance: 1e-6). */
export function samePointXZ(left: Vec3, right: Vec3): boolean {
  return (
    Math.abs(left[0] - right[0]) <= 1e-6 && Math.abs(left[2] - right[2]) <= 1e-6
  );
}

/** XZ 평면 기준 링의 부호 있는 면적 계산 (음수 = CW, 양수 = CCW). */
function signedAreaXZ(ring: Vec3[]): number {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[2] - next[0] * current[2];
  }
  return area / 2;
}
