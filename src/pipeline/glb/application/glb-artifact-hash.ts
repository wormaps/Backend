import { createHash } from 'node:crypto';

import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';

export const GLB_HASH_PLACEHOLDER = `sha256:${'0'.repeat(64)}`;

export async function computeCanonicalGlbArtifactHash(bytes: Uint8Array): Promise<string> {
  const io = new NodeIO();
  io.registerExtensions([EXTMeshoptCompression]);
  await io.init();

  const document = await io.readBinary(bytes);
  const root = document.getRoot();
  root.setExtras(normalizeHashFields(root.getExtras()) as Record<string, unknown>);

  const canonicalBytes = await io.writeBinary(document);
  return `sha256:${createHash('sha256').update(canonicalBytes).digest('hex')}`;
}

export function normalizeHashFields<T>(value: T): T {
  return normalizeHashFieldsRecursive(value) as T;
}

function normalizeHashFieldsRecursive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeHashFieldsRecursive(entry));
  }

  if (value !== null && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'artifactHash' || key === 'validationStamp' || key === 'extrasValidationStamp') {
        normalized[key] = GLB_HASH_PLACEHOLDER;
        continue;
      }

      normalized[key] = normalizeHashFieldsRecursive(nested);
    }

    return normalized;
  }

  return value;
}
