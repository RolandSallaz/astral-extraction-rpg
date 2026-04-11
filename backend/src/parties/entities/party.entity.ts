import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PartyMemberEntity } from './party-member.entity';

@Entity('parties')
export class PartyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ default: 'forming' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => PartyMemberEntity, (member) => member.party, {
    cascade: false,
  })
  members: PartyMemberEntity[];
}
