import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ContainerItemEntity } from './container-item.entity';

@Entity('containers')
export class ContainerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_containers_code', { unique: true })
  @Column({ unique: true })
  code: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar', nullable: true })
  worldId: string | null;

  @Column({ type: 'int' })
  x: number;

  @Column({ type: 'int' })
  y: number;

  @Column({ type: 'int', default: 4 })
  columns: number;

  @Column({ type: 'int', default: 3 })
  rows: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => ContainerItemEntity, (containerItem) => containerItem.container)
  items: ContainerItemEntity[];
}
