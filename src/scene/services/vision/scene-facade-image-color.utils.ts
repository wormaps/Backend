import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import type { MapillaryImage } from '../../../places/clients/mapillary.client';
import { parseAndValidateExternalUrl } from '../../../common/http/external-url-validation.util';

export async function getImageAverageColorHex(
  image: MapillaryImage,
): Promise<string | null> {
  if (!image.thumbnailUrl) {
    return fallbackColorFromImageMeta(image);
  }

  const validatedUrl = parseAndValidateExternalUrl(image.thumbnailUrl, {
    requireHttps: true,
    blockPrivateNetwork: true,
    allowedHosts: resolveThumbnailAllowedHosts(),
    allowSubdomains: true,
  });
  if (!validatedUrl) {
    return fallbackColorFromImageMeta(image);
  }

  try {
    const response = await fetch(validatedUrl);
    if (!response.ok) {
      return fallbackColorFromImageMeta(image);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const hex = decodeAverageHex(bytes);
    return hex ?? fallbackColorFromImageMeta(image);
  } catch {
    return fallbackColorFromImageMeta(image);
  }
}

function resolveThumbnailAllowedHosts(): string[] {
  const configured = process.env.MAPILLARY_IMAGE_ALLOWED_HOSTS?.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (configured && configured.length > 0) {
    return configured;
  }

  return ['mapillary.com', 'mapillaryusercontent.com'];
}

function decodeAverageHex(bytes: Uint8Array): string | null {
  if (bytes.length < 10) {
    return null;
  }

  const pngSignature = bytes[0] === 0x89 && bytes[1] === 0x50;
  const jpegSignature = bytes[0] === 0xff && bytes[1] === 0xd8;

  if (pngSignature) {
    const png = PNG.sync.read(Buffer.from(bytes));
    return averageFromRgba(png.data);
  }
  if (jpegSignature) {
    const decoded = jpeg.decode(Buffer.from(bytes), { useTArray: true });
    return averageFromRgba(decoded.data as Uint8Array);
  }
  return null;
}

function averageFromRgba(data: Uint8Array): string {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 255;
    if (alpha === 0) {
      continue;
    }
    totalR += data[index] ?? 0;
    totalG += data[index + 1] ?? 0;
    totalB += data[index + 2] ?? 0;
    count += 1;
  }
  if (count === 0) {
    return '#808080';
  }
  return rgbToHex(
    Math.round(totalR / count),
    Math.round(totalG / count),
    Math.round(totalB / count),
  );
}

function fallbackColorFromImageMeta(image: MapillaryImage): string {
  const seed = [
    image.id,
    image.thumbnailUrl ?? '',
    image.sequenceId ?? '',
    image.capturedAt ?? '',
    image.compassAngle?.toFixed(1) ?? '',
  ].join('|');
  const hash = createHash('sha256').update(seed).digest();
  return rgbToHex(
    64 + (hash[0] % 128),
    64 + (hash[1] % 128),
    64 + (hash[2] % 128),
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'),
    )
    .join('')}`;
}
