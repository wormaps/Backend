import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health/health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health payload', () => {
    const response = controller.getHealth();

    expect(response.message).toBe('서비스 상태가 정상입니다.');
    expect(response.data.service).toBe('wormapb');
    expect(response.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
