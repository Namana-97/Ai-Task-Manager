import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/access-control';
import { RbacGuard } from '../auth/rbac.guard';
import { AuditLogService } from './audit-log.service';
import { AuthenticatedUser } from '../common/contracts';

@Controller('audit-log')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AuditLogController {
  constructor(@Inject(AuditLogService) private readonly auditLogService: AuditLogService) {}

  @Get()
  @Permissions(Permission.AuditRead)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.auditLogService.list(user);
  }
}
