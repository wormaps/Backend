import type { AccentTone } from './glb-material-factory';
import { hexToRgb } from './building-mesh-utils';

export function resolveAccentTone(palette: string[]): AccentTone {
  const sample = palette.find(Boolean);
  if (!sample) {
    return 'neutral';
  }

  const [r, g, b] = hexToRgb(sample);
  if (Math.abs(r - b) <= 0.08 && Math.abs(r - g) <= 0.08) {
    return 'neutral';
  }
  if (r >= b + 0.06) {
    return 'warm';
  }
  if (b >= r + 0.06) {
    return 'cool';
  }
  return g > 0.5 ? 'cool' : 'neutral';
}
