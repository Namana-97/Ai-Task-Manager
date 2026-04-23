import { Injectable, Logger } from '@nestjs/common';
import { SanitiseResult, SeverityLevel } from './types';

const RULES: Array<{ name: string; pattern: RegExp; severity: SeverityLevel }> = [
  {
    name: 'role_override',
    pattern: /ignore (previous|above|prior)( instructions)?/i,
    severity: SeverityLevel.HIGH
  },
  {
    name: 'system_exfiltration',
    pattern: /(repeat (your|the) (system|instructions))|(starting with SYSTEM:)/i,
    severity: SeverityLevel.HIGH
  },
  {
    name: 'jailbreak',
    pattern: /(DAN|do anything now|pretend you are)/i,
    severity: SeverityLevel.MEDIUM
  },
  {
    name: 'indirect_markup',
    pattern: /(<!--[\s\S]*-->)|(<[^>]+>.*<\/[^>]+>)|(\{[\s\S]*".+":.*\})/i,
    severity: SeverityLevel.LOW
  }
];

@Injectable()
export class InputSanitiser {
  private readonly logger = new Logger(InputSanitiser.name);

  sanitise(input: string, userId = 'anonymous'): SanitiseResult {
    const matches = RULES.filter((rule) => rule.pattern.test(input));

    if (!matches.length) {
      return {
        sanitised: input,
        flagged: false,
        patterns: [],
        severity: SeverityLevel.LOW
      };
    }

    const severity = matches.reduce<SeverityLevel>((current, match) => {
      if (match.severity === SeverityLevel.HIGH) {
        return SeverityLevel.HIGH;
      }
      if (match.severity === SeverityLevel.MEDIUM && current === SeverityLevel.LOW) {
        return SeverityLevel.MEDIUM;
      }
      return current;
    }, SeverityLevel.LOW);

    const sanitised = matches.reduce((current, match) => current.replace(match.pattern, '[redacted]'), input);
    this.logger.warn(
      `Prompt injection attempt flagged for user=${userId} severity=${severity} patterns=${matches
        .map((match) => match.name)
        .join(',')}`
    );

    if (severity === SeverityLevel.HIGH) {
      return {
        sanitised,
        flagged: true,
        patterns: matches.map((match) => match.name),
        severity,
        refusalMessage: 'Your message contains instructions that conflict with secure system behavior.'
      };
    }

    return {
      sanitised,
      flagged: true,
      patterns: matches.map((match) => match.name),
      severity
    };
  }
}
