import { Module } from '@nestjs/common';
import { TtlCacheService } from './ttl-cache.service';

@Module({
  providers: [
    {
      provide: TtlCacheService,
      useFactory: () => new TtlCacheService(1000, undefined),
    },
  ],
  exports: [TtlCacheService],
})
export class CacheModule {}
