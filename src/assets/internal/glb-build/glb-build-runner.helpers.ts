import { AppLoggerService } from '../../../common/logging/app-logger.service';

export interface GlbSimplifyOptions {
  ratio: number;
  error: number;
  lockBorder: boolean;
}

export interface GlbTransformFunctionsModule {
  prune: (options?: Record<string, unknown>) => unknown;
  dedup: (options?: Record<string, unknown>) => unknown;
  instance?: (options?: Record<string, unknown>) => unknown;
  simplify?: (options: {
    simplifier: unknown;
    ratio?: number;
    error?: number;
    lockBorder?: boolean;
  }) => unknown;
  weld: (options?: Record<string, unknown>) => unknown;
  quantize: (options?: Record<string, unknown>) => unknown;
}

export interface TransformableGlbDocument {
  transform: (...transforms: unknown[]) => Promise<void>;
}

export interface GlbValidatorIssue {
  code?: string;
  message?: string;
  pointer?: string;
}

export interface GlbValidatorReport {
  truncated?: boolean;
  issues?: {
    truncated?: boolean;
    numErrors?: number;
    numWarnings?: number;
    numInfos?: number;
    numHints?: number;
    messages?: GlbValidatorIssue[];
  };
}

export async function optimizeGlbDocument(
  doc: unknown,
  sceneId: string,
  transformModule: GlbTransformFunctionsModule,
  simplifyMeshoptSimplifier: unknown | undefined,
  logger: AppLoggerService,
  simplifyConfig: {
    enabled: boolean;
    options: GlbSimplifyOptions;
  },
  options: {
    quantizeOptions: Record<string, unknown>;
    instanceOptions: Record<string, unknown>;
  },
  controls?: {
    simplify?: {
      enabled: boolean;
      options: GlbSimplifyOptions;
    };
    disableInstance?: boolean;
    reason?: string;
  },
): Promise<void> {
  const transformableDoc = doc as TransformableGlbDocument;
  if (typeof transformableDoc.transform !== 'function') {
    return;
  }

  const baseTransforms: unknown[] = [
    transformModule.prune({
      keepExtras: true,
      keepLeaves: true,
      keepAttributes: true,
    }),
    transformModule.dedup({
      keepUniqueNames: true,
    }),
  ];
  const tailTransforms: unknown[] = [
    transformModule.weld(),
    transformModule.quantize(options.quantizeOptions),
  ];
  let supportsInstance = false;
  let supportsSimplify = false;
  let simplifyTransform: unknown;
  let transforms = [...baseTransforms, ...tailTransforms];
  if (!controls?.disableInstance && typeof transformModule.instance === 'function') {
    try {
      const instanceTransform = transformModule.instance(options.instanceOptions);
      if (instanceTransform) {
        supportsInstance = true;
        transforms = [...baseTransforms, instanceTransform, ...tailTransforms];
      }
    } catch (instanceFactoryError) {
      logger.warn('scene.glb_build.optimize_instance_skipped', {
        sceneId,
        step: 'glb_build',
        reason:
          instanceFactoryError instanceof Error
            ? instanceFactoryError.message
            : String(instanceFactoryError),
        fallbackTransforms: ['prune', 'dedup', 'weld', 'quantize'],
        phase: 'instance_factory',
      });
    }
  }
  const effectiveSimplifyConfig = controls?.simplify ?? simplifyConfig;
  if (!effectiveSimplifyConfig.enabled) {
    logger.info('scene.glb_build.optimize_simplify_disabled', {
      sceneId,
      step: 'glb_build',
      env: 'GLB_OPTIMIZE_SIMPLIFY_ENABLED',
    });
  } else if (typeof transformModule.simplify === 'function') {
    if (!simplifyMeshoptSimplifier) {
      logger.warn('scene.glb_build.optimize_simplify_skipped', {
        sceneId,
        step: 'glb_build',
        reason: 'meshopt_simplifier_unavailable',
        fallbackTransforms: ['prune', 'dedup', 'instance?', 'weld', 'quantize'],
        phase: 'simplify_factory',
      });
    } else {
      try {
        simplifyTransform = transformModule.simplify({
          simplifier: simplifyMeshoptSimplifier,
          ratio: effectiveSimplifyConfig.options.ratio,
          error: effectiveSimplifyConfig.options.error,
          lockBorder: effectiveSimplifyConfig.options.lockBorder,
        });
        supportsSimplify = Boolean(simplifyTransform);
      } catch (simplifyFactoryError) {
        logger.warn('scene.glb_build.optimize_simplify_skipped', {
          sceneId,
          step: 'glb_build',
          reason:
            simplifyFactoryError instanceof Error
              ? simplifyFactoryError.message
              : String(simplifyFactoryError),
          fallbackTransforms: ['prune', 'dedup', 'instance?', 'weld', 'quantize'],
          phase: 'simplify_factory',
        });
      }
    }
  }
  if (supportsSimplify) {
    transforms = [
      ...transforms.slice(0, -2),
      simplifyTransform,
      ...transforms.slice(-2),
    ];
  }

  const transformSteps = supportsInstance
    ? ['prune', 'dedup', 'instance']
    : ['prune', 'dedup'];
  if (supportsSimplify) {
    transformSteps.push('simplify');
  }
  transformSteps.push('weld', 'quantize');

  try {
    await transformableDoc.transform(...transforms);

    logger.info('scene.glb_build.optimize', {
      sceneId,
      step: 'glb_build',
      transforms: transformSteps,
      instance: supportsInstance ? options.instanceOptions : undefined,
      simplify: supportsSimplify ? effectiveSimplifyConfig.options : undefined,
      quantize: options.quantizeOptions,
      reason: controls?.reason,
    });
  } catch (error) {
    logger.warn('scene.glb_build.optimization.failed', {
      sceneId,
      step: 'glb_build',
      error: error instanceof Error ? error.message : String(error),
      attemptedTransforms: transformSteps,
      fallback: 'original_document_preserved',
    });
  }
}

export async function validateGlb(
  glbBinary: Uint8Array,
  sceneId: string,
  validatorModule: {
    validateBytes: (
      data: Uint8Array,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  },
  options: {
    severityOverrides: Record<string, number>;
    detailLimit: number;
    logger?: {
      warn: (message: string, context?: Record<string, unknown>) => void;
    };
  },
): Promise<void> {
  const report = (await validatorModule.validateBytes(glbBinary, {
    uri: `${sceneId}.glb`,
    format: 'glb',
    maxIssues: 1000,
    writeTimestamp: false,
    severityOverrides: options.severityOverrides,
  })) as GlbValidatorReport;

  const isTruncated = Boolean(report.truncated || report.issues?.truncated);
  if (isTruncated) {
    options.logger?.warn('scene.glb_build.validation_report_truncated', {
      sceneId,
      step: 'glb_build',
      maxIssues: 1000,
      issueCount: report.issues?.messages?.length ?? 0,
    });
  }

  const numErrors = report.issues?.numErrors ?? 0;
  if (numErrors > 0) {
    const detail = report.issues?.messages
      ?.slice(0, options.detailLimit)
      .map(
        (issue) =>
          `${issue.code ?? 'UNKNOWN'}:${issue.pointer ?? '-'}:${issue.message ?? ''}`,
      )
      .join(' | ');
    const warningSummary = `warnings=${report.issues?.numWarnings ?? 0}, infos=${report.issues?.numInfos ?? 0}, hints=${report.issues?.numHints ?? 0}`;
    throw new Error(
      `GLB validation failed with ${numErrors} error(s) (${warningSummary}).${detail ? ` ${detail}` : ''}`,
    );
  }
}

export async function loadMeshoptimizerModule(): Promise<
  | {
      MeshoptSimplifier?: unknown;
    }
  | undefined
> {
  try {
    return (await import('meshoptimizer/simplifier')) as {
      MeshoptSimplifier?: unknown;
    };
  } catch {
    return undefined;
  }
}

export async function registerNodeIoExtensions(
  io: unknown,
  sceneId: string,
  logger: AppLoggerService,
): Promise<void> {
  const candidateIo = io as {
    registerExtensions?: (extensions: unknown[]) => unknown;
  };
  if (typeof candidateIo.registerExtensions !== 'function') {
    return;
  }

  try {
    const extensionsModule = await import('@gltf-transform/extensions');
    const exportedAllExtensions = (
      extensionsModule as {
        ALL_EXTENSIONS?: unknown;
      }
    ).ALL_EXTENSIONS;
    const allExtensions = Array.isArray(exportedAllExtensions)
      ? exportedAllExtensions
      : Object.values(extensionsModule).filter((extension) => {
          if (typeof extension !== 'function') {
            return false;
          }
          const extensionClass = extension as {
            EXTENSION_NAME?: string;
            prototype?: { EXTENSION_NAME?: string };
          };
          return Boolean(
            extensionClass.EXTENSION_NAME ??
              extensionClass.prototype?.EXTENSION_NAME,
          );
        });
    if (allExtensions.length > 0) {
      candidateIo.registerExtensions(allExtensions);
    }
  } catch (extensionImportError) {
    logger.warn('scene.glb_build.extension_registration_skipped', {
      sceneId,
      step: 'glb_build',
      reason:
        extensionImportError instanceof Error
          ? extensionImportError.message
          : String(extensionImportError),
    });
  }
}
