import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ContainerEntity } from './container.entity';

@Entity('container_items')
@Index('IDX_container_items_container_slot', ['containerId', 'slot'], { unique: true })
export class ContainerItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  containerId: string;

  @ManyToOne(() => ContainerEntity, (container) => container.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'containerId' })
  container: ContainerEntity;

  @Column({ type: 'varchar' })
  itemCode: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'int' })
  slot: number;

  @CreateDateColumn()
  createdAt: Date;
}
