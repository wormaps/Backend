import { QaGateService } from './application/qa-gate.service';

export const qaModule = {
  name: 'qa',
  services: {
    qaGate: new QaGateService(),
  },
} as const;
