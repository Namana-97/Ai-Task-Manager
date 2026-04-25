import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY, Permission } from './access-control';

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
