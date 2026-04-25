import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Inject } from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(@Inject(RequestContextService) private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    return defer(() =>
      this.requestContext.run({ user: request.user }, () => next.handle())
    );
  }
}
