import { MeshPlanBuilderService } from './application/mesh-plan-builder.service';
import { RenderIntentResolverService } from './application/render-intent-resolver.service';

export const renderModule = {
  name: 'render',
  services: {
    renderIntentResolver: new RenderIntentResolverService(),
    meshPlanBuilder: new MeshPlanBuilderService(),
  },
} as const;
