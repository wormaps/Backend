declare module 'earcut' {
  export default function earcut(
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ): number[];
}

declare module 'gltf-validator' {
  export function validateBytes(
    data: Uint8Array,
    options?: {
      maxIssues?: number;
      ignoredIssues?: string[];
      severityOverrides?: Record<string, number>;
    },
  ): Promise<{
    info: {
      version: string;
      generator: string;
      resources: Array<{
        pointer: string;
        mimeType: string;
        storage: string;
        byteLength: number;
      }>;
    };
    issues: {
      numErrors: number;
      numWarnings: number;
      numInfos: number;
      messages: Array<{
        code: string;
        message: string;
        severity: number;
        pointer: string;
      }>;
    };
  }>;
}

declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number; height?: number; filterType?: number });
    static sync: {
      read(buffer: Buffer, options?: { width?: number; height?: number }): PNG;
    };
    width: number;
    height: number;
    data: Buffer;
    pack(): NodeJS.ReadableStream;
    parse(data: Buffer, callback?: (error: Error | null, data: PNG) => void): PNG;
  }
}
