import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseSeedService } from '../database/database-seed.service';
import { OrganizationEntity, UserEntity } from '../database/entities';
import { AuthenticatedUser } from '../common/contracts';
import { RoleName } from './access-control';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: RoleName;
    orgId: string;
    orgName: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(DatabaseSeedService)
    private readonly seedService: DatabaseSeedService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>
  ) {}

  async login(username: string, password: string): Promise<LoginResponse> {
    await this.seedService.ensureSeeded();
    const user = await this.users.findOne({
      where: { username: username.trim().toLowerCase() }
    });

    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const authenticatedUser = await this.toAuthenticatedUser(user);
    const token = await this.jwtService.signAsync({
      sub: authenticatedUser.id,
      username: user.username,
      name: user.displayName,
      role: authenticatedUser.role,
      orgId: authenticatedUser.orgId,
      orgName: authenticatedUser.orgName,
      childOrgIds: authenticatedUser.childOrgIds
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.displayName,
        role: authenticatedUser.role,
        orgId: authenticatedUser.orgId,
        orgName: authenticatedUser.orgName
      }
    };
  }

  async buildAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    await this.seedService.ensureSeeded();
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toAuthenticatedUser(user);
  }

  async getLegacyStubUser(
    authHeader?: string,
    mockUserHeader?: string
  ): Promise<AuthenticatedUser> {
    await this.seedService.ensureSeeded();
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    const requestedRole = mockUserHeader?.trim().toLowerCase();
    const role: RoleName =
      requestedRole === 'owner' || token === 'owner-token'
        ? 'owner'
        : requestedRole === 'viewer' || token === 'viewer-token'
          ? 'viewer'
          : 'admin';
    const username =
      role === 'owner' ? 'taylor' : role === 'viewer' ? 'alex' : 'jordan';
    const user = await this.users.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Legacy stub user not found');
    }

    return this.toAuthenticatedUser(user);
  }

  private async toAuthenticatedUser(user: UserEntity): Promise<AuthenticatedUser> {
    const childOrgIds =
      user.roleName === 'owner'
        ? await this.resolveOrgScope(user.organizationId)
        : [user.organizationId];

    return {
      id: user.id,
      username: user.username,
      name: user.displayName,
      orgId: user.organization.id,
      orgName: user.organization.name,
      role: user.roleName,
      childOrgIds,
      permissions: user.role.permissions
    };
  }

  private async resolveOrgScope(orgId: string): Promise<string[]> {
    const organizations = await this.organizations.find();
    const children = organizations
      .filter((organization) => organization.parentId === orgId)
      .map((organization) => organization.id);
    return [orgId, ...children];
  }
}
