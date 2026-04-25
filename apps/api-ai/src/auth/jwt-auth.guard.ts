import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthenticatedUser } from '../common/contracts';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    const mockUserHeader = request.headers['x-mock-user'] as string | undefined;
    const isStub = process.env.AUTH_STUB !== 'false';
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!bearerToken) {
      request.user = parseStubUser(authHeader, mockUserHeader);
      return true;
    }

    if (isJwtLike(bearerToken) && process.env.JWT_SECRET) {
      request.user = verifyJwtUser(bearerToken, process.env.JWT_SECRET);
      return true;
    }

    if (isStub || !isJwtLike(bearerToken)) {
      request.user = parseStubUser(authHeader, mockUserHeader);
      return true;
    }

    throw new UnauthorizedException('Invalid bearer token');
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest().user as AuthenticatedUser;
});

function parseStubUser(authHeader?: string, mockUserHeader?: string): AuthenticatedUser {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const requestedRole = mockUserHeader?.trim().toLowerCase();
  const role =
    requestedRole === 'owner' || token === 'owner-token'
      ? 'owner'
      : requestedRole === 'viewer' || token === 'viewer-token'
        ? 'viewer'
        : 'admin';

  const seededUserId =
    token && !['dev-stub-token', 'viewer-token', 'owner-token', 'admin-token'].includes(token)
      ? token
      : role === 'owner'
        ? 'user-003'
        : role === 'viewer'
          ? 'user-001'
          : 'user-002';

  return {
    id: seededUserId,
    orgId: 'org-root',
    orgName: 'Acme Product',
    role,
    childOrgIds: ['org-root', 'org-design']
  };
}

function isJwtLike(token: string): boolean {
  return token.split('.').length === 3;
}

function verifyJwtUser(token: string, secret: string): AuthenticatedUser {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new UnauthorizedException('Malformed JWT');
  }

  const header = parseJwtSection(encodedHeader) as { alg?: string; typ?: string };
  if (header.alg !== 'HS256') {
    throw new UnauthorizedException('Unsupported JWT algorithm');
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (!safeEquals(signature, expectedSignature)) {
    throw new UnauthorizedException('JWT signature mismatch');
  }

  const payload = parseJwtSection(encodedPayload) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    throw new UnauthorizedException('JWT expired');
  }

  return {
    id: payload.sub ?? payload.userId ?? payload.id ?? 'jwt-user',
    orgId: payload.orgId ?? 'org-root',
    orgName: payload.orgName ?? 'Acme Product',
    role: normalizeRole(payload.role),
    childOrgIds: Array.isArray(payload.childOrgIds)
      ? payload.childOrgIds.filter((value): value is string => typeof value === 'string')
      : [payload.orgId ?? 'org-root']
  };
}

function parseJwtSection(value: string): unknown {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    throw new UnauthorizedException('Malformed JWT payload');
  }
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeRole(role: unknown): AuthenticatedUser['role'] {
  if (role === 'viewer' || role === 'owner') {
    return role;
  }

  return 'admin';
}

interface JwtPayload {
  sub?: string;
  userId?: string;
  id?: string;
  orgId?: string;
  orgName?: string;
  role?: string;
  childOrgIds?: string[];
  exp?: number;
}
