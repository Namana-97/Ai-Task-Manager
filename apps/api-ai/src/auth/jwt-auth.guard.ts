import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../common/contracts';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      Reflect.getMetadata(IS_PUBLIC_KEY, context.getHandler()) ||
      Reflect.getMetadata(IS_PUBLIC_KEY, context.getClass())
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    const mockUserHeader = request.headers['x-mock-user'] as string | undefined;
    const isStub = process.env.AUTH_STUB === 'true';
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!bearerToken) {
      if (!isStub) {
        throw new UnauthorizedException('Authentication required');
      }
      request.user = await this.authService.getLegacyStubUser(authHeader, mockUserHeader);
      return true;
    }

    if (isJwtLike(bearerToken)) {
      const canActivate = (await super.canActivate(context)) as boolean;
      if (canActivate) {
        return true;
      }
    }

    if (isStub) {
      request.user = await this.authService.getLegacyStubUser(authHeader, mockUserHeader);
      return true;
    }

    throw new UnauthorizedException('Invalid bearer token');
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest().user as AuthenticatedUser;
});

function isJwtLike(token: string): boolean {
  return token.split('.').length === 3;
}
