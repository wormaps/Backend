import { MeshPlanBuilderService } from './application/mesh-plan-builder.service';
import { RenderIntentPolicyService } from './application/render-intent-policy.service';
import { RenderIntentResolverService } from './application/render-intent-resolver.service';
import { realityModule } from '../reality/reality.module';

const renderIntentPolicy = new RenderIntentPolicyService();

export const renderModule = {
  name: 'render',
  services: {
    renderIntentPolicy,
    renderIntentResolver: new RenderIntentResolverService(
      renderIntentPolicy,
      realityModule.services.realityTierResolver,
    ),
    meshPlanBuilder: new MeshPlanBuilderService(),
  },
} as const;
