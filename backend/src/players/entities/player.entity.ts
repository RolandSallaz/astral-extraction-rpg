import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PlayerItemEntity } from './player-item.entity';
import { PlayerRole } from '../player-role.enum';
import type { QuestLog } from '@mmorpg/shared/quests/core';

@Entity('players')
export class PlayerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nickname: string;

  @Column()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: PlayerRole,
    default: PlayerRole.USER,
  })
  role: PlayerRole;

  @Column('simple-json')
  position: { x: number; y: number };

  @Column({ type: 'int', default: 250 })
  gold: number;

  @Column({ type: 'int', default: 100 })
  health: number;

  @Column({ type: 'int', default: 100 })
  maxHealth: number;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'int', default: 0 })
  experience: number;

  @Column({ type: 'int', default: 1 })
  strength: number;

  @Column({ type: 'int', default: 1 })
  agility: number;

  @Column({ type: 'int', default: 1 })
  intellect: number;

  @Column({ type: 'simple-json', nullable: true })
  quests: QuestLog | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => PlayerItemEntity, (playerItem) => playerItem.player, {
    cascade: false,
  })
  items: PlayerItemEntity[];
}
