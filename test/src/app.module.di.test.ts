import { describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { BuildGatewayService } from '../../src/api/build.gateway.service';

describe('AppModule DI', () => {
  it('compiles and resolves BuildGatewayService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const gateway = moduleRef.get(BuildGatewayService);
    expect(gateway).toBeDefined();
  });
});
