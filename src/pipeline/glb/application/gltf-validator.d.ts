declare module 'gltf-validator' {
  export type ValidationIssue = {
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    pointer?: string;
    offset?: number;
  };

  export type ValidationReport = {
    issues?: {
      numErrors: number;
      numWarnings: number;
      numInfos: number;
      numHints: number;
      messages?: ValidationIssue[];
      truncated?: boolean;
    };
    info?: Record<string, unknown>;
  };

  export type ValidationOptions = {
    uri?: string;
    format?: 'glb' | 'gltf';
    externalResourceFunction?: (uri: string) => Promise<Uint8Array>;
    writeTimestamp?: boolean;
    maxIssues?: number;
    ignoredIssues?: string[];
    onlyIssues?: string[];
    severityOverrides?: Record<string, number>;
  };

  export function validateBytes(data: Uint8Array, options?: ValidationOptions): Promise<ValidationReport>;
  export function validateString(json: string, options?: ValidationOptions): Promise<ValidationReport>;
  export function version(): string;
}
