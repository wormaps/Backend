/**
 * Phase 3 Unit 2 — Texture Compatibility Preflight
 *
 * Detects actual bound textures on materials in the built glTF document,
 * verifies TEXCOORD_0 presence on primitives that use textured materials,
 * and fails closed before serialization when incompatibility is found.
 *
 * Keys off actual bound textures in the document (not config intent).
 */

export interface TexcoordPreflightIssue {
  meshName: string;
  materialName: string;
  missingAttribute: string;
  /** When true, this issue is a sentinel indicating the inspection itself threw. */
  inspectionFailed?: boolean;
}

export interface TexcoordPreflightReport {
  valid: boolean;
  issues: TexcoordPreflightIssue[];
}

/**
 * Safely invoke a method on an object, preserving `this` binding.
 *
 * gltf-transform methods (getName, getBaseColorTexture, getAttribute, etc.)
 * rely on `this.getRef()` / `this.getRefMap()` internally. Extracting them
 * as standalone functions and calling without the original object as `this`
 * causes runtime throws like "undefined is not an object (evaluating 'this.getRef')".
 */
function safeCall<T>(obj: unknown, method: string, ...args: unknown[]): T | undefined {
  const record = obj as Record<string, unknown> | null;
  const fn = record?.[method] as ((...a: unknown[]) => T) | undefined;
  if (typeof fn !== 'function') return undefined;
  return fn.apply(obj, args);
}

/**
 * Walk the glTF document and detect primitives that reference textured
 * materials but lack TEXCOORD_0 vertex attributes.
 *
 * Uses @gltf-transform/core Document API directly — no new dependencies.
 */
export function runTexcoordPreflight(doc: unknown): TexcoordPreflightReport {
  const issues: TexcoordPreflightIssue[] = [];

  try {
    const root = safeCall<unknown>(doc, 'getRoot');
    if (root == null) {
      return { valid: true, issues };
    }

    // Collect materials that actually have a baseColorTexture bound.
    const texturedMaterialNames = collectTexturedMaterialNames(root);

    // Walk all meshes and check primitives against textured materials.
    const meshes = safeCall<unknown[]>(root, 'listMeshes');
    if (!Array.isArray(meshes)) {
      return { valid: true, issues };
    }

    for (const mesh of meshes) {
      const meshName = safeCall<string>(mesh, 'getName') ?? 'unknown';

      const primitives = safeCall<unknown[]>(mesh, 'listPrimitives');
      if (!Array.isArray(primitives)) continue;

      for (const prim of primitives) {
        // Check TEXCOORD_0 presence — call getAttribute with proper `this` binding.
        const texcoord = safeCall<unknown>(prim, 'getAttribute', 'TEXCOORD_0');
        const hasTexcoord = texcoord !== null && texcoord !== undefined;

        // Get the material name — call getMaterial then getName with proper `this` binding.
        const material = safeCall<unknown>(prim, 'getMaterial');
        const materialName = material != null
          ? (safeCall<string>(material, 'getName') ?? 'unknown')
          : 'unknown';

        // If material has a bound texture but primitive lacks TEXCOORD_0 → fail
        if (texturedMaterialNames.has(materialName) && !hasTexcoord) {
          issues.push({
            meshName,
            materialName,
            missingAttribute: 'TEXCOORD_0',
          });
        }
      }
    }
  } catch {
    // Preflight should never block the pipeline due to its own errors.
    // If we can't inspect the document, we fail closed with a sentinel
    // that distinguishes inspection failure from a real missing-TEXCOORD issue.
    return {
      valid: false,
      issues: [{ meshName: 'preflight', materialName: 'preflight', missingAttribute: 'TEXCOORD_0', inspectionFailed: true }],
    };
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Collect names of all materials in the document that have a baseColorTexture bound.
 * This keys off actual runtime state, not configuration intent.
 */
function collectTexturedMaterialNames(root: unknown): Set<string> {
  const texturedNames = new Set<string>();

  const materials = safeCall<unknown[]>(root, 'listMaterials');
  if (!Array.isArray(materials)) {
    return texturedNames;
  }

  for (const material of materials) {
    const materialName = safeCall<string>(material, 'getName') ?? 'unknown';

    // Check if baseColorTexture is actually bound.
    // @gltf-transform/core Material.getBaseColorTexture() returns Texture | null.
    const texture = safeCall<unknown>(material, 'getBaseColorTexture');
    if (texture !== null && texture !== undefined) {
      texturedNames.add(materialName);
    }
  }

  return texturedNames;
}

/**
 * Build a human-readable error message for preflight failure.
 *
 * When the failure is due to the inspection itself throwing (inspectionFailed
 * sentinel), the message explicitly says so to avoid confusing operators with
 * a genuine "missing TEXCOORD_0" diagnosis.
 */
export function formatTexcoordPreflightError(report: TexcoordPreflightReport): string {
  const isInspectionFailure = report.issues.some((issue) => issue.inspectionFailed);

  if (isInspectionFailure) {
    return `TEXCOORD_0 preflight inspection failed unexpectedly: the preflight routine threw while examining the document. The pipeline is failing closed as a safety measure. This is NOT a confirmed missing-TEXCOORD_0 issue — investigate the preflight routine itself.`;
  }

  const details = report.issues
    .map((issue) => `mesh="${issue.meshName}" material="${issue.materialName}" missing=${issue.missingAttribute}`)
    .join('; ');
  return `TEXCOORD_0 preflight failed: ${report.issues.length} textured primitive(s) lack required vertex attribute(s). ${details}`;
}
