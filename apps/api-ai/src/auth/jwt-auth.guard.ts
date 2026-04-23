import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator
} from '@nestjs/common';
import { AuthenticatedUser } from '../common/contracts';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    const mockUserHeader = request.headers['x-mock-user'] as string | undefined;
    const isStub = process.env.AUTH_STUB !== 'false';

    if (isStub) {
      request.user = parseStubUser(authHeader, mockUserHeader);
      return true;
    }

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = parseStubUser(authHeader, mockUserHeader);
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest().user as AuthenticatedUser;
});

function parseStubUser(authHeader?: string, mockUserHeader?: string): AuthenticatedUser {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const requestedRole = mockUserHeader?.trim().toLowerCase();
  return {
    id: token || 'user-001',
    orgId: 'org-root',
    orgName: 'Acme Product',
    role:
      requestedRole === 'owner' || token === 'owner-token'
        ? 'owner'
        : requestedRole === 'viewer' || token === 'viewer-token'
          ? 'viewer'
          : 'admin',
    childOrgIds: ['org-root', 'org-design']
  };
}
