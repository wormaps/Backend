import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MapboxDemAdapter {
  private readonly logger = new Logger(MapboxDemAdapter.name);
  private readonly token = process.env.MAPBOX_TOKEN ?? '';
  /** Tile RGBA cache keyed by `z/x/y` — avoids re-fetching the same tile. */
  private readonly tileCache = new Map<string, Uint8Array>();

  constructor() {}

  /** Convenience wrapper — single point. */
  async getElevation(lat: number, lng: number): Promise<number> {
    const [elev] = await this.getElevationsForPoints({ lat, lng }, [{ lat, lng }]);
    return elev ?? 0;
  }

  /**
   * Fetch elevation for every point, handling tile boundaries correctly.
   *
   * Points near the origin tile edge are sampled from the correct adjacent tile
   * (not silently clamped). Tiles are cached in memory per adapter instance so
   * repeated scenes that share a tile only pay one HTTP fetch.
   *
   * Returns one elevation (metres, absolute) per input point, in order.
   */
  async getElevationsForPoints(
    _origin: { lat: number; lng: number },
    points: Array<{ lat: number; lng: number }>,
  ): Promise<number[]> {
    if (points.length === 0) return [];
    const zoom = 12;

    // -----------------------------------------------------------------------
    // Group points by their tile to minimise fetch count.
    // -----------------------------------------------------------------------
    type TileKey = string; // `z/x/y`
    const tileGroups = new Map<TileKey, Array<{ idx: number; pixelX: number; pixelY: number }>>();

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

    const crossTileCount = tileGroups.size - 1;
    if (crossTileCount > 0) {
      this.logger.debug(`DEM: ${crossTileCount} extra tile(s) needed for boundary-crossing points`);
    }

    // -----------------------------------------------------------------------
    // Fetch each unique tile (parallel) and sample elevations.
    // -----------------------------------------------------------------------
    const results = new Array<number>(points.length).fill(0);

    await Promise.all(
      [...tileGroups.entries()].map(async ([key, group]) => {
        const [z, x, y] = key.split('/').map(Number) as [number, number, number];
        const rgba = await this.fetchTileCached(z, x, y);
        for (const { idx, pixelX, pixelY } of group) {
          const offset = (pixelY * 256 + pixelX) * 4;
          const r = rgba[offset] ?? 0;
          const g = rgba[offset + 1] ?? 0;
          const b = rgba[offset + 2] ?? 0;
          results[idx] = -10000 + (r * 65536 + g * 256 + b) * 0.1;
        }
      }),
    );

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async fetchTileCached(zoom: number, tileX: number, tileY: number): Promise<Uint8Array> {
    const key = `${zoom}/${tileX}/${tileY}`;
    const cached = this.tileCache.get(key);
    if (cached) return cached;
    const bytes = await this.fetchTile(zoom, tileX, tileY);
    this.tileCache.set(key, bytes);
    return bytes;
  }

  private async fetchTile(zoom: number, tileX: number, tileY: number): Promise<Uint8Array> {
    if (!this.token) {
      throw new Error('MAPBOX_TOKEN is not configured');
    }
    const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}.pngraw?access_token=${this.token}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox DEM fetch failed: ${response.status} ${response.statusText}`);
    }
    const bytes = await this.decodePng(new Uint8Array(await response.arrayBuffer()));
    this.logger.debug(`DEM tile fetched z=${zoom} x=${tileX} y=${tileY}`);
    return bytes;
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
