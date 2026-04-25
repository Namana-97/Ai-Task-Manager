import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../common/contracts';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get('standup')
  async standup(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: 'personal' | 'team'
  ) {
    return this.reportsService.generateStandup(
      user,
      scope ?? (user.role === 'viewer' ? 'personal' : 'team')
    );
  }
}
