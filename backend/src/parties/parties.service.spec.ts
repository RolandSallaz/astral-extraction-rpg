import { BadRequestException } from '@nestjs/common';
import { PartiesService } from './parties.service';

function createPlayer(id: string, nickname: string) {
  return {
    id,
    nickname,
    quests: {
      znakomstvo: {
        rewardClaimedAt: new Date().toISOString(),
      },
    },
  };
}

describe('PartiesService', () => {
  let activePlayerIds: Set<string>;
  let service: PartiesService;

  beforeEach(() => {
    activePlayerIds = new Set();
    service = new PartiesService({
      isPlayerActive: jest.fn((playerId: string) => activePlayerIds.has(playerId)),
    } as never);
  });

  it('transfers leadership when the leader leaves', async () => {
    const leader = createPlayer('player-1', 'Leader');
    const member = createPlayer('player-2', 'Member');
    activePlayerIds.add(leader.id);
    activePlayerIds.add(member.id);

    const party = await service.createParty(leader as never);
    await service.joinParty(member as never, { code: party.code });
    await service.leaveParty(leader as never);

    const memberParty = await service.getPartyForPlayer(member as never);
    expect(memberParty?.members).toHaveLength(1);
    expect(memberParty?.members[0]).toMatchObject({
      playerId: member.id,
      isLeader: true,
    });
  });

  it('removes inactive members when the party is read', async () => {
    const leader = createPlayer('player-1', 'Leader');
    const member = createPlayer('player-2', 'Member');
    activePlayerIds.add(leader.id);
    activePlayerIds.add(member.id);

    const party = await service.createParty(leader as never);
    await service.joinParty(member as never, { code: party.code });

    activePlayerIds.delete(member.id);

    const leaderParty = await service.getPartyForPlayer(leader as never);
    expect(leaderParty?.members).toHaveLength(1);
    expect(leaderParty?.members[0]).toMatchObject({
      playerId: leader.id,
      isLeader: true,
    });

    const memberParty = await service.getPartyForPlayer(member as never);
    expect(memberParty).toBeNull();
  });

  it('rejects starting party actions before the introduction quest is completed', async () => {
    await expect(
      service.createParty({
        id: 'player-1',
        nickname: 'Locked',
        quests: {},
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
