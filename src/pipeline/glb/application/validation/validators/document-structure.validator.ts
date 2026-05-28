import { type Document } from '@gltf-transform/core';

import type { MeshPlan } from '../../../../../shared/contracts';
import type { QaIssue } from '../../../../../shared/contracts';
import { createQaIssue } from '../common/issue.factory';

export function validateDocumentStructure(document: Document): QaIssue[] {
  return [
    ...validateTransformFinite(document),
    ...validateBoundsSanity(document),
    ...validatePrimitivePolicy(document),
    ...validateAccessorMinMax(document),
    ...validateIndexBufferRanges(document),
  ];
}

export function validateTriangleBudget(document: Document, meshPlan: MeshPlan): QaIssue[] {
  const issues: QaIssue[] = [];
  let triangleCount = 0;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      if (indices !== null) {
        triangleCount += Math.floor(indices.getCount() / 3);
        continue;
      }
      const position = primitive.getAttribute('POSITION');
      if (position !== null) {
        triangleCount += Math.floor(position.getCount() / 3);
      }
    }
  }

  if (triangleCount > meshPlan.budgets.maxTriangleCount) {
    issues.push(
      createQaIssue(
        'DCC_GLB_TRIANGLE_COUNT_EXCEEDED',
        'critical',
        'fail_build',
        'mesh',
        `GLB triangle count ${triangleCount} exceeds budget ${meshPlan.budgets.maxTriangleCount}.`,
        triangleCount,
        meshPlan.budgets.maxTriangleCount,
      ),
    );
  }

  return issues;
}

function validateTransformFinite(document: Document): QaIssue[] {
  const issues: QaIssue[] = [];
  for (const node of document.getRoot().listNodes()) {
    const translation = node.getTranslation();
    const rotation = node.getRotation();
    const scale = node.getScale();

    for (let i = 0; i < 3; i++) {
      if (!Number.isFinite(translation[i])) {
        issues.push(createQaIssue('DCC_GLB_INVALID_TRANSFORM', 'critical', 'fail_build', 'mesh', `Node "${node.getName()}" has non-finite translation[${i}]: ${translation[i]}.`));
      }
      if (!Number.isFinite(scale[i])) {
        issues.push(createQaIssue('DCC_GLB_INVALID_TRANSFORM', 'critical', 'fail_build', 'mesh', `Node "${node.getName()}" has non-finite scale[${i}]: ${scale[i]}.`));
      }
    }

    for (let i = 0; i < 4; i++) {
      if (!Number.isFinite(rotation[i])) {
        issues.push(createQaIssue('DCC_GLB_INVALID_TRANSFORM', 'critical', 'fail_build', 'mesh', `Node "${node.getName()}" has non-finite rotation[${i}]: ${rotation[i]}.`));
      }
    }
  }
  return issues;
}

function validateBoundsSanity(document: Document): QaIssue[] {
  const issues: QaIssue[] = [];
  const MAX_SCENE_EXTENT_METERS = 5000;
  const globalMin: number[] = [Infinity, Infinity, Infinity];
  const globalMax: number[] = [-Infinity, -Infinity, -Infinity];

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (position === null) continue;

      const min = position.getMin([]);
      const max = position.getMax([]);
      if (min === undefined || max === undefined) continue;

      for (let i = 0; i < 3; i++) {
        const minVal = min[i] ?? 0;
        const maxVal = max[i] ?? 0;
        if (minVal < globalMin[i]!) globalMin[i] = minVal;
        if (maxVal > globalMax[i]!) globalMax[i] = maxVal;
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(globalMin[i]) || !Number.isFinite(globalMax[i])) {
      issues.push(createQaIssue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', `Scene bounds contain non-finite values at axis ${i}: min=${globalMin[i]}, max=${globalMax[i]}.`));
      return issues;
    }
  }

  const minExtent = Math.min(...globalMin.map((_, i) => globalMax[i]! - globalMin[i]!));
  const maxExtent = Math.max(...globalMax.map((_, i) => globalMax[i]! - globalMin[i]!));

  if (maxExtent <= 0) {
    issues.push(createQaIssue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', 'Scene bounding box is degenerate (all axes have zero extent).'));
    return issues;
  }

  if (!Number.isFinite(minExtent) || !Number.isFinite(maxExtent)) {
    issues.push(createQaIssue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', `Scene bounding box has non-finite extent: min=${minExtent}, max=${maxExtent}.`));
    return issues;
  }

  if (maxExtent >= MAX_SCENE_EXTENT_METERS) {
    issues.push(createQaIssue('DCC_GLB_BOUNDS_INVALID', 'critical', 'fail_build', 'mesh', `Scene bounding box max extent ${maxExtent}m exceeds limit of ${MAX_SCENE_EXTENT_METERS}m.`));
  }

  return issues;
}

function validatePrimitivePolicy(document: Document): QaIssue[] {
  const issues: QaIssue[] = [];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) {
        issues.push(createQaIssue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" uses mode ${primitive.getMode()}, expected TRIANGLES (4).`));
      }

      const position = primitive.getAttribute('POSITION');
      if (position === null) {
        issues.push(createQaIssue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" has no POSITION accessor.`));
      } else if (position.getCount() < 3) {
        issues.push(createQaIssue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" has only ${position.getCount()} vertices, minimum is 3.`));
      }

      if (primitive.getMaterial() === null) {
        issues.push(createQaIssue('DCC_GLB_PRIMITIVE_POLICY_VIOLATION', 'major', 'warn_only', 'mesh', `Primitive "${primitive.getName()}" has no material.`));
      }
    }
  }

  return issues;
}

function validateAccessorMinMax(document: Document): QaIssue[] {
  const issues: QaIssue[] = [];

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (position === null) continue;

      const min = position.getMin([]);
      const max = position.getMax([]);
      if (min === undefined || max === undefined) {
        issues.push(createQaIssue('DCC_GLB_ACCESSOR_MINMAX_INVALID', 'critical', 'fail_build', 'mesh', `POSITION accessor for primitive "${primitive.getName()}" is missing min/max bounds.`));
      } else {
        for (let i = 0; i < 3; i++) {
          const minVal = min[i];
          const maxVal = max[i];
          if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
            issues.push(createQaIssue('DCC_GLB_ACCESSOR_MINMAX_INVALID', 'critical', 'fail_build', 'mesh', `POSITION accessor for primitive "${primitive.getName()}" has min[${i}] (${minVal}) > max[${i}] (${maxVal}).`));
          }
        }

        const count = position.getCount();
        const sampleSize = Math.min(count, 100);
        const step = Math.max(1, Math.floor(count / sampleSize));
        for (let i = 0; i < count; i += step) {
          const element = position.getElement(i, []);
          for (let j = 0; j < 3; j++) {
            const val = element[j];
            if (val === undefined || !Number.isFinite(val)) continue;
            const minVal = min[j];
            const maxVal = max[j];
            if (minVal !== undefined && val < minVal) {
              issues.push(createQaIssue('DCC_GLB_ACCESSOR_MINMAX_INVALID', 'critical', 'fail_build', 'mesh', `POSITION vertex ${i} of primitive "${primitive.getName()}" has value ${val} below min[${j}] (${minVal}).`));
              break;
            }
            if (maxVal !== undefined && val > maxVal) {
              issues.push(createQaIssue('DCC_GLB_ACCESSOR_MINMAX_INVALID', 'critical', 'fail_build', 'mesh', `POSITION vertex ${i} of primitive "${primitive.getName()}" has value ${val} above max[${j}] (${maxVal}).`));
              break;
            }
          }
        }
      }

      const indices = primitive.getIndices();
      if (indices !== null) {
        const indexMin = indices.getMin([]);
        if (indexMin === undefined) {
          issues.push(createQaIssue('DCC_GLB_ACCESSOR_MINMAX_INVALID', 'critical', 'fail_build', 'mesh', `INDICES accessor for primitive "${primitive.getName()}" is missing min bounds.`));
        } else if (indexMin[0] !== undefined && indexMin[0] < 0) {
          issues.push(createQaIssue('DCC_GLB_ACCESSOR_MINMAX_INVALID', 'critical', 'fail_build', 'mesh', `INDICES accessor for primitive "${primitive.getName()}" has negative min value (${indexMin[0]}).`));
        }
      }
    }
  }

  return issues;
}

function validateIndexBufferRanges(document: Document): QaIssue[] {
  const issues: QaIssue[] = [];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      if (indices === null || position === null) continue;

      const vertexCount = position.getCount();
      const indexMax = indices.getMax([]);
      if (indexMax === undefined) continue;
      const maxIndex = indexMax[0];

      if (maxIndex !== undefined && maxIndex >= vertexCount) {
        issues.push(createQaIssue('DCC_GLB_INDEX_OUT_OF_RANGE', 'critical', 'fail_build', 'mesh', `Index buffer max value (${maxIndex}) exceeds vertex count (${vertexCount}) for primitive "${primitive.getName()}".`));
      }
    }
  }
  return issues;
}
