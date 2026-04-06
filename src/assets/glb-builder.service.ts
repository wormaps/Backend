import { Injectable } from '@nestjs/common';
import { GlbBuildRunner } from './internal/glb-build';

@Injectable()
export class GlbBuilderService extends GlbBuildRunner {}
