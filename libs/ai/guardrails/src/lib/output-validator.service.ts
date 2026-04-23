import { Injectable } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class OutputValidator {
  validate<T>(schema: ZodSchema<T>, payload: unknown): T {
    return schema.parse(payload);
  }
}
