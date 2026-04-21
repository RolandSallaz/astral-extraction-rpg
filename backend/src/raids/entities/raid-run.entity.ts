import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RaidRuntimeState } from '@mmorpg/shared';

@Entity('raid_runs')
export class RaidRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  seed: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 1 })
  playerCount: number;

  @Column({ type: 'simple-json', nullable: true })
  generatedLayout: {
    width: number;
    height: number;
    rooms: Array<{ x: number; y: number; width: number; height: number }>;
    spawnPoints: Array<{ x: number; y: number }>;
    chests: Array<{ x: number; y: number }>;
    exitPoints: Array<{ x: number; y: number }>;
  } | null;

  @Column({ type: 'simple-json', nullable: true })
  runtimeState: RaidRuntimeState | null;

  @Column({ type: 'timestamp', nullable: true })
  runtimeStateUpdatedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @Column()
  templateCode: string;

  @Column()
  templateName: string;

  @Column({ default: 'crypt' })
  biome: string;

  @Column({ type: 'int', default: 1 })
  minPlayers: number;

  @Column({ type: 'int', default: 4 })
  maxPlayers: number;

  @Column({ type: 'int', default: 30 })
  width: number;

  @Column({ type: 'int', default: 20 })
  height: number;

  @Column({ type: 'uuid', nullable: true })
  partyId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
