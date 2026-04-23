import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../common/contracts';
import { InsightsService } from './insights.service';

@Controller('insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(@Inject(InsightsService) private readonly insightsService: InsightsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.insightsService.getInsights(user);
  }
}
