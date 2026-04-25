import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { AnthropicIntentClassifier, TaskActionExecutor } from '@ai-task-manager/ai/intents';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../common/contracts';
import { ReportsService } from '../reports/reports.service';
import { RbacGuard } from '../auth/rbac.guard';
import { IntentAuthorizationService } from './intent-authorization.service';

@Controller('intents')
@UseGuards(JwtAuthGuard, RbacGuard)
export class IntentsController {
  constructor(
    @Inject(AnthropicIntentClassifier)
    private readonly classifier: AnthropicIntentClassifier,
    @Inject(TaskActionExecutor)
    private readonly executor: TaskActionExecutor,
    @Inject(ReportsService)
    private readonly reportsService: ReportsService,
    @Inject(IntentAuthorizationService)
    private readonly intentAuthorization: IntentAuthorizationService
  ) {}

  @Post('classify')
  async classify(@Body() body: { message: string; conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }> }) {
    return this.classifier.classify(body.message, body.conversationHistory ?? []);
  }

  @Post('execute')
  async execute(
    @Body() body: { intent: Awaited<ReturnType<AnthropicIntentClassifier['classify']>> },
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.intentAuthorization.authorize(body.intent, user);

    if (body.intent.type === 'status_report') {
      const scope =
        body.intent.parameters?.scope === 'team' ? 'team' : 'personal';
      const report = await this.reportsService.generateStandup(user, scope);
      return {
        success: true,
        message: report.markdown,
        data: report
      };
    }

    return this.executor.execute(body.intent, {
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    });
  }
}
