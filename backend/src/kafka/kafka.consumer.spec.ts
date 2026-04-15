import { KafkaConsumerService } from './kafka.consumer';

describe('KafkaConsumerService', () => {
  function createService() {
    const playersService = {
      findPlayerById: jest.fn(),
      updatePlayer: jest.fn(),
    };
    const raidsService = {
      persistRuntimeState: jest.fn(),
    };

    return {
      service: new KafkaConsumerService(playersService as never, raidsService as never),
      playersService,
      raidsService,
    };
  }

  it('skips profile snapshots without a valid updatedAt', async () => {
    const { service, playersService } = createService();

    await (service as any).handlePlayerProfileUpdate({
      playerId: 'player-1',
      gold: 250,
    });

    expect(playersService.findPlayerById).not.toHaveBeenCalled();
    expect(playersService.updatePlayer).not.toHaveBeenCalled();
  });

  it('skips stale profile snapshots older than the current player row', async () => {
    const { service, playersService } = createService();
    playersService.findPlayerById.mockResolvedValue({
      id: 'player-1',
      updatedAt: new Date('2026-04-15T12:00:00.000Z'),
    });

    await (service as any).handlePlayerProfileUpdate({
      playerId: 'player-1',
      gold: 300,
      updatedAt: '2026-04-15T11:59:59.000Z',
    });

    expect(playersService.findPlayerById).toHaveBeenCalledWith('player-1');
    expect(playersService.updatePlayer).not.toHaveBeenCalled();
  });

  it('persists profile snapshots when they are as new or newer than the current player row', async () => {
    const { service, playersService } = createService();
    const player = {
      id: 'player-1',
      updatedAt: new Date('2026-04-15T12:00:00.000Z'),
    };
    playersService.findPlayerById.mockResolvedValue(player);

    await (service as any).handlePlayerProfileUpdate({
      playerId: 'player-1',
      gold: 300,
      quests: { intro: { status: 'started' } },
      updatedAt: '2026-04-15T12:00:00.000Z',
    });

    expect(playersService.findPlayerById).toHaveBeenCalledWith('player-1');
    expect(playersService.updatePlayer).toHaveBeenCalledWith(player, {
      gold: 300,
      quests: { intro: { status: 'started' } },
    });
  });

  it('skips raid runtime snapshots without a valid updatedAt', async () => {
    const { service, raidsService } = createService();

    await (service as any).handleRaidRunUpdate({
      raidRunId: 'raid-1',
      runtimeState: {
        status: 'active',
        expiresAt: 123,
        updatedAt: '',
        mobs: [],
        chests: [],
        groundEffects: [],
      },
    });

    expect(raidsService.persistRuntimeState).not.toHaveBeenCalled();
  });

  it('persists raid runtime snapshots with a valid updatedAt', async () => {
    const { service, raidsService } = createService();

    await (service as any).handleRaidRunUpdate({
      raidRunId: 'raid-1',
      updatedAt: '2026-04-15T12:00:00.000Z',
      runtimeState: {
        status: 'active',
        expiresAt: 123,
        updatedAt: '2026-04-15T12:00:00.000Z',
        mobs: [],
        chests: [],
        groundEffects: [],
      },
    });

    expect(raidsService.persistRuntimeState).toHaveBeenCalledWith(
      'raid-1',
      expect.objectContaining({
        status: 'active',
        expiresAt: 123,
      }),
      '2026-04-15T12:00:00.000Z',
    );
  });
});
