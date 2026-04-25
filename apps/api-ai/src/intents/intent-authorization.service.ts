import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ClassifiedIntent } from '@ai-task-manager/ai/intents';
import { AuthenticatedUser } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';
import { Permission, ROLE_PERMISSIONS } from '../auth/access-control';

@Injectable()
export class IntentAuthorizationService {
  constructor(
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub
  ) {}

  async authorize(intent: ClassifiedIntent, user: AuthenticatedUser): Promise<void> {
    const permissions = user.permissions ?? ROLE_PERMISSIONS[user.role];

    switch (intent.type) {
      case 'create_task':
        this.requirePermission(permissions, Permission.TaskCreate);
        return;
      case 'update_task':
        if (!this.hasUpdateFields(intent.parameters)) {
          return;
        }
        this.requirePermission(permissions, Permission.TaskUpdate);
        await this.requireScopedTask(intent.parameters?.taskId, user);
        return;
      case 'delete_task':
        this.requirePermission(permissions, Permission.TaskDelete);
        await this.requireScopedTask(intent.parameters?.taskId, user);
        return;
      case 'status_report':
        return;
      default:
        return;
    }
  }

  private requirePermission(userPermissions: string[], permission: Permission): void {
    if (!userPermissions.includes(permission)) {
      throw new ForbiddenException('Permission denied');
    }
  }

  private async requireScopedTask(
    taskId: unknown,
    user: AuthenticatedUser
  ): Promise<void> {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      throw new ForbiddenException('Task access denied');
    }

    const task = await this.repository.findById(taskId, {
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    });

    if (!task) {
      throw new ForbiddenException('Task access denied');
    }
  }

  private hasUpdateFields(parameters: ClassifiedIntent['parameters']): boolean {
    if (!parameters) {
      return false;
    }

    return Object.entries(parameters).some(([key, value]) => key !== 'taskId' && value != null);
  }
}
