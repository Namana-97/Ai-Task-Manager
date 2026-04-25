import { ExecutionContext } from '@nestjs/common';
import { RbacGuard } from './rbac.guard';
import { Permissions } from './permissions.decorator';
import { Permission } from './access-control';

class RbacTestController {
  @Permissions(Permission.AuditRead)
  audit() {}
}

describe('RbacGuard', () => {
  const guard = new RbacGuard();
  const handler = new RbacTestController().audit;

  it('allows an admin with audit permission', () => {
    const allowed = guard.canActivate(
      createContext(handler, {
        id: 'user-002',
        orgId: 'org-root',
        orgName: 'Acme Product',
        role: 'admin',
        permissions: [Permission.AuditRead]
      })
    );

    expect(allowed).toBe(true);
  });

  it('blocks a viewer without audit permission', () => {
    expect(() =>
      guard.canActivate(
        createContext(handler, {
          id: 'user-001',
          orgId: 'org-root',
          orgName: 'Acme Product',
          role: 'viewer',
          permissions: [Permission.TaskRead]
        })
      )
    ).toThrow('Permission denied');
  });
});

function createContext(handler: (...args: any[]) => void, user: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    getArgByIndex: () => undefined,
    getArgs: () => [],
    getClass: () => RbacTestController,
    getHandler: () => handler,
    switchToRpc: () => ({ getContext: () => undefined, getData: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined, getPattern: () => undefined }),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => undefined,
      getNext: () => undefined
    })
  } as unknown as ExecutionContext;
}
