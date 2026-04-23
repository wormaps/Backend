import { EvidenceGraphBuilderService } from './application/evidence-graph-builder.service';
import { TwinGraphBuilderService } from './application/twin-graph-builder.service';

export const twinModule = {
  name: 'twin',
  services: {
    evidenceGraphBuilder: new EvidenceGraphBuilderService(),
    twinGraphBuilder: new TwinGraphBuilderService(),
  },
} as const;
