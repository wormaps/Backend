import { GlbCompilerService } from './application/glb-compiler.service';
import { GlbValidationService } from './application/glb-validation.service';

export const glbModule = {
  name: 'glb',
  services: {
    glbCompiler: new GlbCompilerService(),
    glbValidation: new GlbValidationService(),
  },
} as const;
