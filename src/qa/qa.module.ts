import { QaGateService } from './application/qa-gate.service';
import { realityModule } from '../reality/reality.module';

export const qaModule = {
  name: 'qa',
  services: {
    qaGate: new QaGateService(realityModule.services.realityTierResolver),
  },
} as const;
