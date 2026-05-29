import { Injectable, Logger } from '@nestjs/common';

/** RGB in 0–255 range. */
export type SatelliteColor = [number, number, number];

/**
 * Samples building facade colors from Mapbox satellite tiles.
 * Uses zoom 17 (~1.2 m/px) for per-building resolution.
 * Returns one RGB triple per input point in the same order.
 */
@Injectable()
export class MapboxSatelliteAdapter {
  private readonly logger = new Logger(MapboxSatelliteAdapter.name);
  private readonly token = process.env.MAPBOX_TOKEN ?? '';
  private readonly tileCache = new Map<string, Uint8Array>();

  /**
   * Fetch one stitched satellite image covering a lat/lng bbox via the Mapbox
   * Static Images API. Used to drape real aerial imagery over the ground grid.
   * Returns raw image bytes + mime type, or undefined when unavailable.
   */
  async fetchBboxImage(bbox: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  }): Promise<{ bytes: Uint8Array; mimeType: string } | undefined> {
    if (!this.token) return undefined;
    const size = 1024;
    const bboxStr = `[${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}]`;
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${bboxStr}/${size}x${size}?access_token=${this.token}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Satellite bbox image failed: ${response.status} ${response.statusText}`);
        return undefined;
      }
      const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, mimeType };
    } catch (err) {
      this.logger.warn(`Satellite bbox image error: ${String(err)}`);
      return undefined;
    }
  }

  async sampleColors(
    points: Array<{ lat: number; lng: number }>,
  ): Promise<SatelliteColor[]> {
    if (!this.token || points.length === 0) return points.map(() => [128, 128, 128]);
    const zoom = 17;

    type TileKey = string;
    const tileGroups = new Map<
      TileKey,
      Array<{ idx: number; pixelX: number; pixelY: number }>
    >();

    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const { tileX, tileY, pixelX, pixelY } = this.latLngToTilePixel(p.lat, p.lng, zoom);
      const key: TileKey = `${zoom}/${tileX}/${tileY}`;
      let group = tileGroups.get(key);
      if (!group) {
        group = [];
        tileGroups.set(key, group);
      }
      group.push({ idx: i, pixelX, pixelY });
    }

    const results: SatelliteColor[] = points.map(() => [128, 128, 128]);

    await Promise.all(
      [...tileGroups.entries()].map(async ([key, group]) => {
        const [z, x, y] = key.split('/').map(Number) as [number, number, number];
        try {
          const rgba = await this.fetchTileCached(z, x, y);
          for (const { idx, pixelX, pixelY } of group) {
            const offset = (pixelY * 256 + pixelX) * 4;
            results[idx] = [rgba[offset] ?? 128, rgba[offset + 1] ?? 128, rgba[offset + 2] ?? 128];
          }
        } catch (err) {
          this.logger.warn(`Satellite tile ${key} failed: ${String(err)}`);
        }
      }),
    );

    return results;
  }

  private async fetchTileCached(zoom: number, tileX: number, tileY: number): Promise<Uint8Array> {
    const key = `${zoom}/${tileX}/${tileY}`;
    const cached = this.tileCache.get(key);
    if (cached) return cached;
    const bytes = await this.fetchTile(zoom, tileX, tileY);
    this.tileCache.set(key, bytes);
    return bytes;
  }

  private async fetchTile(zoom: number, tileX: number, tileY: number): Promise<Uint8Array> {
    const url = `https://api.mapbox.com/v4/mapbox.satellite/${zoom}/${tileX}/${tileY}.png?access_token=${this.token}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Satellite tile fetch failed: ${response.status} ${response.statusText}`);
    }
    return this.decodePng(new Uint8Array(await response.arrayBuffer()));
  }

  private async decodePng(bytes: Uint8Array): Promise<Uint8Array> {
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(Buffer.from(bytes));
    const buf = png.data as Buffer;
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  private latLngToTilePixel(
    lat: number,
    lng: number,
    zoom: number,
  ): { tileX: number; tileY: number; pixelX: number; pixelY: number } {
    const n = Math.pow(2, zoom);
    const tileXFrac = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const tileYFrac =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const tileX = Math.floor(tileXFrac);
    const tileY = Math.floor(tileYFrac);
    const pixelX = Math.min(255, Math.max(0, Math.floor((tileXFrac - tileX) * 256)));
    const pixelY = Math.min(255, Math.max(0, Math.floor((tileYFrac - tileY) * 256)));
    return { tileX, tileY, pixelX, pixelY };
  }
}
