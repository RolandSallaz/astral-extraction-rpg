import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlayerEntity } from '../../players/entities/player.entity';

@Entity('player_sessions')
@Index('IDX_player_sessions_token', ['token'], { unique: true })
export class PlayerSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @ManyToOne(() => PlayerEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'playerId' })
  player: PlayerEntity;

  @Column({ type: 'varchar' })
  token: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
