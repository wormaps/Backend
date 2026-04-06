import { Injectable } from '@nestjs/common';
import { GlbBuildRunner } from './internal/glb-build-runner';

@Injectable()
export class GlbBuilderService extends GlbBuildRunner {}
