export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

export enum Permission {
  TaskRead = 'task:read',
  TaskCreate = 'task:create',
  TaskUpdate = 'task:update',
  TaskDelete = 'task:delete',
  AuditRead = 'audit:read'
}

export type RoleName = 'owner' | 'admin' | 'viewer';

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  owner: [
    Permission.TaskRead,
    Permission.TaskCreate,
    Permission.TaskUpdate,
    Permission.TaskDelete,
    Permission.AuditRead
  ],
  admin: [
    Permission.TaskRead,
    Permission.TaskCreate,
    Permission.TaskUpdate,
    Permission.TaskDelete,
    Permission.AuditRead
  ],
  viewer: [Permission.TaskRead]
};
