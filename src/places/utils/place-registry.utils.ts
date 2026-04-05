import { ExternalPlaceDetail } from '../types/external-place.types';
import { RegistryInfo } from '../types/place.types';

export function toRegistryLikePlace(place: ExternalPlaceDetail): RegistryInfo {
  return {
    id: place.placeId,
    slug: place.placeId,
    name: place.displayName,
    country: 'Unknown',
    city: 'Unknown',
    location: place.location,
    placeType: resolvePlaceType(place),
    tags: place.types,
  };
}

function resolvePlaceType(place: ExternalPlaceDetail): RegistryInfo['placeType'] {
  const types = new Set(place.types);

  if (
    types.has('train_station') ||
    types.has('subway_station') ||
    types.has('transit_station')
  ) {
    return 'STATION';
  }

  if (types.has('tourist_attraction') || types.has('plaza')) {
    return 'PLAZA';
  }

  if (types.has('intersection')) {
    return 'CROSSING';
  }

  return 'SQUARE';
}
