import { createRoadDecalStripeGeometry } from './road-mesh.builder';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

describe('road-mesh.builder', () => {
  it('builds stripe geometry from hero stripe_set decals', () => {
    const geometry = createRoadDecalStripeGeometry(
      coordinate(35.659482, 139.7005596),
      [
        {
          objectId: 'hero-stripes',
          type: 'CROSSWALK_OVERLAY',
          color: '#f8f8f6',
          emphasis: 'hero',
          priority: 'hero',
          layer: 'crosswalk_overlay',
          shapeKind: 'stripe_set',
          styleToken: 'scramble_white',
          stripeSet: {
            centerPath: [
              coordinate(35.65978, 139.70023),
              coordinate(35.65918, 139.70088),
            ],
            stripeCount: 8,
            stripeDepth: 0.9,
            halfWidth: 8,
          },
        },
      ],
      ['CROSSWALK_OVERLAY'],
    );

    expect(geometry.positions.length).toBeGreaterThan(0);
    expect(geometry.indices.length).toBeGreaterThan(0);
  });
});
