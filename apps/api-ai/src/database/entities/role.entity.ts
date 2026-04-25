import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { PermissionEntity } from './permission.entity';

@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryColumn({ type: 'varchar' })
  name!: 'owner' | 'admin' | 'viewer';

  @Column({ type: 'simple-json' })
  permissions!: string[];

  @ManyToMany(() => PermissionEntity, (permission) => permission.roles, { eager: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_name', referencedColumnName: 'name' },
    inverseJoinColumn: { name: 'permission_name', referencedColumnName: 'name' }
  })
  structuredPermissions!: PermissionEntity[];

  @OneToMany(() => UserEntity, (user) => user.role)
  users!: UserEntity[];
}
