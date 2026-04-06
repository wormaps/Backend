import type { GeoBounds } from '../../types/place.types';
import type { OverpassScope } from './overpass.types';

export function buildQuery(bounds: GeoBounds, scope: OverpassScope): string {
  const bbox = `(${bounds.southWest.lat},${bounds.southWest.lng},${bounds.northEast.lat},${bounds.northEast.lng})`;
  const selectors =
    scope === 'core'
      ? [
          `way["building"]${bbox};`,
          `relation["building"]${bbox};`,
          `way["highway"]${bbox};`,
          `way["footway"="crossing"]${bbox};`,
          `way["highway"]["crossing"]${bbox};`,
          `node["amenity"]${bbox};`,
          `node["tourism"]${bbox};`,
          `node["shop"]${bbox};`,
          `node["public_transport"]${bbox};`,
        ]
      : scope === 'street'
        ? [
            `node["highway"="traffic_signals"]${bbox};`,
            `node["highway"="street_lamp"]${bbox};`,
            `node["traffic_sign"]${bbox};`,
            `node["natural"="tree"]${bbox};`,
          ]
        : [
            `way["landuse"]${bbox};`,
            `way["leisure"]${bbox};`,
            `way["natural"]${bbox};`,
            `way["waterway"]${bbox};`,
            `way["railway"]${bbox};`,
            `way["bridge"]${bbox};`,
          ];

  return `
[out:json][timeout:25];
(
  ${selectors.join('\n  ')}
);
out geom qt;
    `.trim();
}
