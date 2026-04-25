import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RbacGuard } from './rbac.guard';
import { DatabaseSeedService } from '../database/database-seed.service';
import { OrganizationEntity, RoleEntity, TaskEntity, UserEntity } from '../database/entities';
import { TaskPersistenceService } from '../repository/task-persistence.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: {
        expiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 3600)
      }
    }),
    TypeOrmModule.forFeature([OrganizationEntity, RoleEntity, UserEntity, TaskEntity])
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RbacGuard,
    DatabaseSeedService,
    TaskPersistenceService
  ],
  exports: [AuthService, JwtAuthGuard, RbacGuard, DatabaseSeedService]
})
export class AuthModule {}
