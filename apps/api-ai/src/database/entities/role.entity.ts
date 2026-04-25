import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryColumn({ type: 'varchar' })
  name!: 'owner' | 'admin' | 'viewer';

  @Column({ type: 'simple-json' })
  permissions!: string[];

  @OneToMany(() => UserEntity, (user) => user.role)
  users!: UserEntity[];
}
