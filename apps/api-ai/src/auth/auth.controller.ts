import { Body, Controller, Inject, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  async login(@Body() body: { username?: string; password?: string }) {
    return this.authService.login(body.username ?? '', body.password ?? '');
  }
}
