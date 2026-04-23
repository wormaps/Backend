import { GlbCompilerService } from './application/glb-compiler.service';

export const glbModule = {
  name: 'glb',
  services: {
    glbCompiler: new GlbCompilerService(),
  },
} as const;
