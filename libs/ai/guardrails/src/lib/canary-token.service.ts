import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CanaryTokenValidator {
  private readonly logger = new Logger(CanaryTokenValidator.name);
  private readonly canaryToken = process.env.CANARY_TOKEN ?? '__SYSTEM_BOUNDARY_42__';

  inject(prompt: string): string {
    return prompt.includes(this.canaryToken) ? prompt : `${prompt}\n${this.canaryToken}`;
  }

  hasLeak(output: string): boolean {
    const leaked = output.includes(this.canaryToken);
    if (leaked) {
      this.logger.error('Canary token leakage detected in model output');
    }
    return leaked;
  }

  getToken(): string {
    return this.canaryToken;
  }
}
