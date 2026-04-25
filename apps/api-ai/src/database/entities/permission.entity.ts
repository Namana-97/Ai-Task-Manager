import { Column, Entity, ManyToMany, PrimaryColumn } from 'typeorm';
import { RoleEntity } from './role.entity';

@Entity({ name: 'permissions' })
export class PermissionEntity {
  @PrimaryColumn({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  description!: string;

  @ManyToMany(() => RoleEntity, (role) => role.structuredPermissions)
  roles!: RoleEntity[];
}
