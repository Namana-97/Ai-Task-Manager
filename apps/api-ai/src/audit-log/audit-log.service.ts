import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthenticatedUser, Task } from '../common/contracts';
import { AuditLogEntity } from '../database/entities';
import { RequestContextService } from '../common/request-context.service';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogs: Repository<AuditLogEntity>,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService
  ) {}

  async logTaskMutation(
    action: 'create' | 'update' | 'delete',
    task: Pick<Task, 'id' | 'title' | 'status' | 'org'>,
    details?: string
  ): Promise<void> {
    const actor = this.requestContext.getUser();
    await this.auditLogs.save(
      this.auditLogs.create({
        actorUserId: actor?.id ?? null,
        actorName: actor?.name ?? actor?.username ?? null,
        actorRole: actor?.role ?? null,
        orgId: task.org.id,
        action,
        resourceType: 'task',
        resourceId: task.id,
        details: details ?? `${task.title} (${task.status})`
      })
    );
  }

  async list(user: AuthenticatedUser): Promise<AuditLogEntity[]> {
    const orgIds =
      user.role === 'owner'
        ? user.childOrgIds && user.childOrgIds.length > 0
          ? user.childOrgIds
          : [user.orgId]
        : [user.orgId];

    return this.auditLogs.find({
      where: { orgId: In(orgIds) },
      order: { createdAt: 'DESC' },
      take: 200
    });
  }
}
