export class MapboxDemAdapter {
  constructor(private readonly token: string) {}

  async getElevation(lat: number, lng: number): Promise<number> {
    const zoom = 12;
    const { tileX, tileY, pixelX, pixelY } = this.latLngToTilePixel(lat, lng, zoom);
    const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}.pngraw?access_token=${this.token}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox DEM fetch failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const rgba = await this.decodePng(new Uint8Array(arrayBuffer));
    const offset = (pixelY * 256 + pixelX) * 4;
    const r = rgba[offset] ?? 0;
    const g = rgba[offset + 1] ?? 0;
    const b = rgba[offset + 2] ?? 0;

    return -10000 + (r * 65536 + g * 256 + b) * 0.1;
  }

  private async decodePng(bytes: Uint8Array): Promise<Uint8Array> {
    try {
      // pngjs is an optional peer dependency — dynamic import so missing module doesn't break the build.
      // @ts-expect-error pngjs types may not be installed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { PNG } = await import('pngjs');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const png = PNG.sync.read(Buffer.from(bytes));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return new Uint8Array((png.data as Buffer).buffer);
    } catch {
      // pngjs not installed or decode failed — return zeros (elevation ~0m above sea level).
      return new Uint8Array(256 * 256 * 4);
    }
  }

  private latLngToTilePixel(
    lat: number,
    lng: number,
    zoom: number,
  ): { tileX: number; tileY: number; pixelX: number; pixelY: number } {
    const n = Math.pow(2, zoom);
    const tileXFrac = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const tileYFrac = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const tileX = Math.floor(tileXFrac);
    const tileY = Math.floor(tileYFrac);
    const pixelX = Math.min(255, Math.max(0, Math.floor((tileXFrac - tileX) * 256)));
    const pixelY = Math.min(255, Math.max(0, Math.floor((tileYFrac - tileY) * 256)));
    return { tileX, tileY, pixelX, pixelY };
  }
}
