import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlayerEntity } from '../../players/entities/player.entity';
import { PartyEntity } from './party.entity';

type PendingRaidMemberState = {
  raidRunId: string;
  startedAt: string | null;
  realtimeRoom: {
    roomName: string;
    options: Record<string, string | number>;
  };
};

@Entity('party_members')
export class PartyMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: false })
  isLeader: boolean;

  @Column({ default: false })
  isReady: boolean;

  @Column({ type: 'simple-json', nullable: true })
  pendingRaid: PendingRaidMemberState | null;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne(() => PartyEntity, (party) => party.members, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  party: PartyEntity;

  @ManyToOne(() => PlayerEntity, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  player: PlayerEntity;
}
