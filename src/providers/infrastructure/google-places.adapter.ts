export type GooglePlacesTextSearchResult = {
  places: Array<{
    id: string;
    displayName: { text: string };
    types: string[];
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
    businessStatus?: string;
  }>;
};

export type GooglePlacesDetailsResult = {
  id: string;
  displayName: { text: string };
  types: string[];
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
};

export type PlacesData = {
  provider: 'google_places';
  sceneId: string;
  places: Array<{
    placeId: string;
    name: string;
    types: string[];
    location: { lat: number; lng: number };
    rating?: number;
    businessStatus?: string;
  }>;
};

export class GooglePlacesAdapter {
  constructor(private readonly apiKey: string) {}

  async searchPlaces(query: string, lat: number, lng: number, radius: number = 150): Promise<PlacesData> {
    const url = 'https://places.googleapis.com/v1/places:searchText';

    const body = {
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
      pageSize: 10,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.location,places.rating,places.userRatingCount,places.businessStatus',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as GooglePlacesTextSearchResult;

    return {
      provider: 'google_places',
      sceneId: `${lat},${lng}`,
      places: (data.places ?? []).map((p) => ({
        placeId: p.id,
        name: p.displayName.text,
        types: p.types,
        location: {
          lat: p.location?.latitude ?? lat,
          lng: p.location?.longitude ?? lng,
        },
        rating: p.rating,
        businessStatus: p.businessStatus,
      })),
    };
  }

  async searchPlaceDetails(placeId: string): Promise<GooglePlacesDetailsResult> {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'id,displayName,types,location,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,googleMapsUri',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Places Details API error: ${response.status}`);
    }

    const data = (await response.json()) as GooglePlacesDetailsResult;
    return data;
  }
}
