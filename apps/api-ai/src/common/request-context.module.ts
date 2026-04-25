import { Module } from '@nestjs/common';
import { RequestContextInterceptor } from './request-context.interceptor';
import { RequestContextService } from './request-context.service';

@Module({
  providers: [RequestContextService, RequestContextInterceptor],
  exports: [RequestContextService, RequestContextInterceptor]
})
export class RequestContextModule {}
