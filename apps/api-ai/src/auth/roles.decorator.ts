import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY, RoleName } from './access-control';

export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
