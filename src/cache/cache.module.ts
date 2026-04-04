import { Module } from '@nestjs/common';
import { TtlCacheService } from './ttl-cache.service';

@Module({
  providers: [TtlCacheService],
  exports: [TtlCacheService],
})
export class CacheModule {}
