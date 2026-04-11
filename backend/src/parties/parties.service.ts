import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerEntity } from '../players/entities/player.entity';
import { hasCompletedIntroductionQuest } from '../players/player-quest.types';
import { JoinPartyDto } from './dto/join-party.dto';
import { PartyMemberEntity } from './entities/party-member.entity';
import { PartyEntity } from './entities/party.entity';

@Injectable()
export class PartiesService {
  constructor(
    @InjectRepository(PartyEntity)
    private readonly partiesRepository: Repository<PartyEntity>,
    @InjectRepository(PartyMemberEntity)
    private readonly partyMembersRepository: Repository<PartyMemberEntity>,
  ) {}

  async getPartyForPlayer(player: PlayerEntity) {
    const membership = await this.partyMembersRepository.findOne({
      where: { player: { id: player.id } },
      relations: {
        party: true,
      },
    });

    if (!membership) {
      return null;
    }

    return this.serializeParty(await this.loadPartyById(membership.party.id), player.id);
  }

  async createParty(player: PlayerEntity) {
    const existingParty = await this.getPartyForPlayer(player);
    if (existingParty) {
      return existingParty;
    }

    if (!hasCompletedIntroductionQuest(player.quests)) {
      throw new BadRequestException('Complete the introduction quest before using parties.');
    }

    const party = this.partiesRepository.create({
      code: this.generatePartyCode(),
      status: 'forming',
    });
    const savedParty = await this.partiesRepository.save(party);

    const member = this.partyMembersRepository.create({
      party: savedParty,
      player,
      isLeader: true,
      isReady: true,
    });
    await this.partyMembersRepository.save(member);

    return this.serializeParty(await this.loadPartyById(savedParty.id), player.id);
  }

  async joinParty(player: PlayerEntity, input: JoinPartyDto) {
    const existingParty = await this.getPartyForPlayer(player);
    if (existingParty) {
      return existingParty;
    }

    if (!hasCompletedIntroductionQuest(player.quests)) {
      throw new BadRequestException('Complete the introduction quest before using parties.');
    }

    const party = await this.partiesRepository.findOne({
      where: { code: input.code.toUpperCase() },
    });
    if (!party) {
      throw new NotFoundException('Party not found.');
    }

    const member = this.partyMembersRepository.create({
      party,
      player,
      isLeader: false,
      isReady: false,
    });
    await this.partyMembersRepository.save(member);

    return this.serializeParty(await this.loadPartyById(party.id), player.id);
  }

  async setReady(player: PlayerEntity, ready: boolean) {
    const membership = await this.partyMembersRepository.findOne({
      where: { player: { id: player.id } },
      relations: {
        party: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Party membership not found.');
    }

    membership.isReady = ready;
    await this.partyMembersRepository.save(membership);
    return this.serializeParty(await this.loadPartyById(membership.party.id), player.id);
  }

  async leaveParty(player: PlayerEntity) {
    const membership = await this.partyMembersRepository.findOne({
      where: { player: { id: player.id } },
      relations: {
        party: true,
      },
    });

    if (!membership) {
      return null;
    }

    const partyId = membership.party.id;
    const wasLeader = membership.isLeader;
    await this.partyMembersRepository.remove(membership);

    const remainingMembers = await this.partyMembersRepository.find({
      where: { party: { id: partyId } },
      relations: {
        party: true,
      },
    });

    if (remainingMembers.length === 0) {
      await this.partiesRepository.delete({ id: partyId });
      return null;
    }

    if (wasLeader) {
      remainingMembers[0].isLeader = true;
      await this.partyMembersRepository.save(remainingMembers[0]);
    }

    return this.serializeParty(await this.loadPartyById(partyId), player.id);
  }

  async markPendingRaidForParty(
    partyId: string,
    pendingRaid: NonNullable<PartyMemberEntity['pendingRaid']>,
  ) {
    const members = await this.partyMembersRepository.find({
      where: { party: { id: partyId } },
      relations: {
        party: true,
      },
    });

    if (members.length === 0) {
      return;
    }

    members.forEach((member) => {
      member.pendingRaid = pendingRaid;
    });
    await this.partyMembersRepository.save(members);
  }

  async ackPendingRaid(player: PlayerEntity, raidRunId?: string) {
    const membership = await this.partyMembersRepository.findOne({
      where: { player: { id: player.id } },
      relations: {
        party: true,
      },
    });

    if (!membership) {
      return null;
    }

    if (!membership.pendingRaid) {
      return this.serializeParty(await this.loadPartyById(membership.party.id), player.id);
    }

    if (!raidRunId || membership.pendingRaid.raidRunId === raidRunId) {
      membership.pendingRaid = null;
      await this.partyMembersRepository.save(membership);
    }

    return this.serializeParty(await this.loadPartyById(membership.party.id), player.id);
  }

  async requirePartyLeader(player: PlayerEntity) {
    const membership = await this.partyMembersRepository.findOne({
      where: { player: { id: player.id } },
      relations: {
        party: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Party not found.');
    }

    if (!membership.isLeader) {
      throw new BadRequestException('Party leader required.');
    }

    return this.loadPartyById(membership.party.id);
  }

  private async loadPartyById(id: string) {
    const party = await this.partiesRepository.findOne({
      where: { id },
      relations: {
        members: true,
      },
    });

    if (!party) {
      throw new NotFoundException('Party not found.');
    }

    party.members = await this.partyMembersRepository.find({
      where: { party: { id: party.id } },
      order: {
        joinedAt: 'ASC',
      },
    });

    return party;
  }

  private serializeParty(party: PartyEntity, currentPlayerId?: string) {
    const currentMember = currentPlayerId
      ? party.members.find((member) => member.player.id === currentPlayerId) ?? null
      : null;

    return {
      id: party.id,
      code: party.code,
      status: party.status,
      pendingRaid: currentMember?.pendingRaid ?? null,
      members: party.members.map((member) => ({
        playerId: member.player.id,
        nickname: member.player.nickname,
        isLeader: member.isLeader,
        isReady: member.isReady,
      })),
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
    };
  }

  private generatePartyCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }
}
