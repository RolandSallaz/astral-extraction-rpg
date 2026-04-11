import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PlayerEntity } from './player.entity';

@Entity('player_items')
@Index('IDX_player_items_inventory_slot', ['playerId', 'inventorySlot'], {
  unique: true,
  where: '"inventorySlot" IS NOT NULL',
})
@Index('IDX_player_items_equipped_slot', ['playerId', 'equippedSlot'], {
  unique: true,
  where: '"equippedSlot" IS NOT NULL',
})
@Index('IDX_player_items_socket_slot', ['parentItemId', 'socketIndex'], {
  unique: true,
  where: '"parentItemId" IS NOT NULL AND "socketIndex" IS NOT NULL',
})
export class PlayerItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @ManyToOne(() => PlayerEntity, (player) => player.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'playerId' })
  player: PlayerEntity;

  @Column({ type: 'varchar' })
  itemCode: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'int', nullable: true })
  inventorySlot: number | null;

  @Column({ type: 'varchar', nullable: true })
  equippedSlot: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentItemId: string | null;

  @ManyToOne(() => PlayerItemEntity, (item) => item.socketedItems, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentItemId' })
  parentItem: PlayerItemEntity | null;

  @OneToMany(() => PlayerItemEntity, (item) => item.parentItem)
  socketedItems: PlayerItemEntity[];

  @Column({ type: 'int', nullable: true })
  socketIndex: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
