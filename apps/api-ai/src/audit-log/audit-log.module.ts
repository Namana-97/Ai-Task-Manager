import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { RequestContextModule } from '../common/request-context.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity]), AuthModule, RequestContextModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService]
})
export class AuditLogModule {}
