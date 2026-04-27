export type TomTomFlowResponse = {
  flowSegmentData: {
    frc: string;
    currentSpeed: number;
    freeFlowSpeed: number;
    currentTravelTime: number;
    freeFlowTravelTime: number;
    confidence: number;
    coordinates?: { coordinate: Array<{ latitude: number; longitude: number }> };
  };
};

export type TrafficFlowData = {
  provider: 'tomtom';
  currentSpeedKph: number;
  freeFlowSpeedKph: number;
  confidence: number;
  travelTimeRatio: number;
};

export class TomTomTrafficAdapter {
  constructor(private readonly apiKey: string) {}

  async queryTrafficFlow(lat: number, lng: number): Promise<TrafficFlowData> {
    const params = new URLSearchParams();
    params.set('key', this.apiKey);
    params.set('point', `${lat},${lng}`);
    params.set('unit', 'KMPH');
    params.set('trafficModelID', '2');

    const response = await fetch(
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/89/json?${params}`,
    );

    if (!response.ok) {
      throw new Error(`TomTom API error: ${response.status}`);
    }

    const data = (await response.json()) as TomTomFlowResponse;
    const flow = data.flowSegmentData;

    return {
      provider: 'tomtom',
      currentSpeedKph: flow.currentSpeed,
      freeFlowSpeedKph: flow.freeFlowSpeed,
      confidence: flow.confidence,
      travelTimeRatio: flow.currentTravelTime / flow.freeFlowTravelTime,
    };
  }
}
