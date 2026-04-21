import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlayerSessionsService } from '../auth/player-sessions.service';
import { PlayerEntity } from '../players/entities/player.entity';
import { hasCompletedIntroductionQuest } from '../players/player-quest.types';
import { JoinPartyDto } from './dto/join-party.dto';

type PendingRaidState = {
  raidRunId: string;
  startedAt: string | null;
  realtimeRoom: {
    roomName: string;
    options: Record<string, unknown>;
  };
};

type PartyMemberState = {
  playerId: string;
  nickname: string;
  isLeader: boolean;
  isReady: boolean;
  pendingRaid: PendingRaidState | null;
  joinedAt: Date;
};

type PartyState = {
  id: string;
  code: string;
  status: string;
  members: PartyMemberState[];
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PartiesService {
  private readonly partiesById = new Map<string, PartyState>();
  private readonly partyIdByCode = new Map<string, string>();
  private readonly partyIdByPlayerId = new Map<string, string>();

  constructor(private readonly playerSessionsService: PlayerSessionsService) {}

  async getPartyForPlayer(player: PlayerEntity) {
    const party = this.getPartyForPlayerId(player.id);
    if (!party) {
      return null;
    }

    this.pruneInactiveMembers(party);
    const nextParty = this.getPartyForPlayerId(player.id);
    return nextParty ? this.serializeParty(nextParty, player.id) : null;
  }

  async createParty(player: PlayerEntity) {
    const existingParty = await this.getPartyForPlayer(player);
    if (existingParty) {
      return existingParty;
    }

    if (!hasCompletedIntroductionQuest(player.quests)) {
      throw new BadRequestException('Complete the introduction quest before using parties.');
    }

    const now = new Date();
    const party: PartyState = {
      id: randomUUID(),
      code: this.generatePartyCode(),
      status: 'forming',
      members: [
        {
          playerId: player.id,
          nickname: player.nickname,
          isLeader: true,
          isReady: true,
          pendingRaid: null,
          joinedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.partiesById.set(party.id, party);
    this.partyIdByCode.set(party.code, party.id);
    this.partyIdByPlayerId.set(player.id, party.id);
    return this.serializeParty(party, player.id);
  }

  async joinParty(player: PlayerEntity, input: JoinPartyDto) {
    const existingParty = await this.getPartyForPlayer(player);
    if (existingParty) {
      return existingParty;
    }

    if (!hasCompletedIntroductionQuest(player.quests)) {
      throw new BadRequestException('Complete the introduction quest before using parties.');
    }

    const partyId = this.partyIdByCode.get(input.code.toUpperCase());
    const party = partyId ? this.partiesById.get(partyId) ?? null : null;
    if (!party) {
      throw new NotFoundException('Party not found.');
    }

    this.pruneInactiveMembers(party);

    const resolvedParty = this.partiesById.get(party.id);
    if (!resolvedParty) {
      throw new NotFoundException('Party not found.');
    }

    resolvedParty.members.push({
      playerId: player.id,
      nickname: player.nickname,
      isLeader: false,
      isReady: false,
      pendingRaid: null,
      joinedAt: new Date(),
    });
    resolvedParty.updatedAt = new Date();
    this.partyIdByPlayerId.set(player.id, resolvedParty.id);

    return this.serializeParty(resolvedParty, player.id);
  }

  async setReady(player: PlayerEntity, ready: boolean) {
    const party = this.getRequiredPartyForPlayer(player.id);
    const member = party.members.find((entry) => entry.playerId === player.id);
    if (!member) {
      throw new NotFoundException('Party membership not found.');
    }

    member.isReady = ready;
    party.updatedAt = new Date();
    return this.serializeParty(party, player.id);
  }

  async leaveParty(player: PlayerEntity) {
    const party = this.getPartyForPlayerId(player.id);
    if (!party) {
      return null;
    }

    this.removeMemberFromParty(party, player.id);
    const nextParty = this.getPartyForPlayerId(player.id);
    return nextParty ? this.serializeParty(nextParty, player.id) : null;
  }

  async markPendingRaidForParty(partyId: string, pendingRaid: PendingRaidState) {
    const party = this.partiesById.get(partyId);
    if (!party) {
      return;
    }

    this.pruneInactiveMembers(party);
    const resolvedParty = this.partiesById.get(partyId);
    if (!resolvedParty) {
      return;
    }

    resolvedParty.members.forEach((member) => {
      member.pendingRaid = pendingRaid;
    });
    resolvedParty.updatedAt = new Date();
  }

  async ackPendingRaid(player: PlayerEntity, raidRunId?: string) {
    const party = this.getPartyForPlayerId(player.id);
    if (!party) {
      return null;
    }

    const member = party.members.find((entry) => entry.playerId === player.id);
    if (!member) {
      return null;
    }

    if (!member.pendingRaid) {
      return this.serializeParty(party, player.id);
    }

    if (!raidRunId || member.pendingRaid.raidRunId === raidRunId) {
      member.pendingRaid = null;
      party.updatedAt = new Date();
    }

    return this.serializeParty(party, player.id);
  }

  async requirePartyLeader(player: PlayerEntity) {
    const party = this.getRequiredPartyForPlayer(player.id);
    const member = party.members.find((entry) => entry.playerId === player.id);
    if (!member?.isLeader) {
      throw new BadRequestException('Party leader required.');
    }

    return {
      id: party.id,
      code: party.code,
      status: party.status,
      createdAt: party.createdAt,
      updatedAt: party.updatedAt,
      members: party.members.map((entry) => ({
        player: {
          id: entry.playerId,
          nickname: entry.nickname,
        },
        isLeader: entry.isLeader,
        isReady: entry.isReady,
        pendingRaid: entry.pendingRaid,
        joinedAt: entry.joinedAt,
      })),
    };
  }

  private getRequiredPartyForPlayer(playerId: string) {
    const party = this.getPartyForPlayerId(playerId);
    if (!party) {
      throw new NotFoundException('Party not found.');
    }

    this.pruneInactiveMembers(party);
    const resolvedParty = this.getPartyForPlayerId(playerId);
    if (!resolvedParty) {
      throw new NotFoundException('Party not found.');
    }

    return resolvedParty;
  }

  private getPartyForPlayerId(playerId: string) {
    const partyId = this.partyIdByPlayerId.get(playerId);
    if (!partyId) {
      return null;
    }

    return this.partiesById.get(partyId) ?? null;
  }

  private pruneInactiveMembers(party: PartyState) {
    const inactiveMembers = party.members.filter(
      (member) => !this.playerSessionsService.isPlayerActive(member.playerId),
    );

    inactiveMembers.forEach((member) => {
      this.removeMemberFromParty(party, member.playerId);
    });
  }

  private removeMemberFromParty(party: PartyState, playerId: string) {
    const memberIndex = party.members.findIndex((entry) => entry.playerId === playerId);
    if (memberIndex < 0) {
      return;
    }

    const [removedMember] = party.members.splice(memberIndex, 1);
    this.partyIdByPlayerId.delete(playerId);

    if (party.members.length === 0) {
      this.deleteParty(party.id);
      return;
    }

    if (removedMember?.isLeader && !party.members.some((member) => member.isLeader)) {
      party.members[0].isLeader = true;
    }

    party.updatedAt = new Date();
  }

  private deleteParty(partyId: string) {
    const party = this.partiesById.get(partyId);
    if (!party) {
      return;
    }

    party.members.forEach((member) => {
      this.partyIdByPlayerId.delete(member.playerId);
    });
    this.partyIdByCode.delete(party.code);
    this.partiesById.delete(partyId);
  }

  private serializeParty(party: PartyState, currentPlayerId?: string) {
    const currentMember = currentPlayerId
      ? party.members.find((member) => member.playerId === currentPlayerId) ?? null
      : null;

    return {
      id: party.id,
      code: party.code,
      status: party.status,
      pendingRaid: currentMember?.pendingRaid ?? null,
      members: [...party.members]
        .sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime())
        .map((member) => ({
          playerId: member.playerId,
          nickname: member.nickname,
          isLeader: member.isLeader,
          isReady: member.isReady,
        })),
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
    };
  }

  private generatePartyCode() {
    let code = '';

    do {
      code = Math.random().toString(36).slice(2, 8).toUpperCase();
    } while (this.partyIdByCode.has(code));

    return code;
  }
}
