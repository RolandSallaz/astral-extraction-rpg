import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RaidTemplateDefinition, RaidTemplateFiles } from './raid-template-files';
import type { RaidRunEntity } from './entities/raid-run.entity';
import type { PlayerEntity } from '../players/entities/player.entity';
import { StartRaidUseCase } from './use-cases/start-raid.use-case';

type MockRepository<T> = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function createMockRepository<T>(): MockRepository<T> {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createTemplate(overrides: Partial<RaidTemplateDefinition> = {}): RaidTemplateDefinition {
  return {
    code: 'crypt',
    name: 'Crypt',
    description: 'Procedural crypt for delves beyond the first rite.',
    biome: 'crypt',
    minPlayers: 1,
    maxPlayers: 4,
    width: 64,
    height: 64,
    isActive: true,
    ...overrides,
  };
}

function createRun(
  template: RaidTemplateDefinition,
  overrides: Partial<RaidRunEntity> = {},
): RaidRunEntity {
  const now = new Date();
  return {
    id: 'run-1',
    seed: 'shared-seed',
    status: 'ready',
    playerCount: 2,
    generatedLayout: {
      width: template.width,
      height: template.height,
      rooms: [],
      spawnPoints: [],
      chests: [],
      exitPoints: [],
    },
    startedAt: now,
    finishedAt: null,
    templateCode: template.code,
    templateName: template.name,
    biome: template.biome,
    minPlayers: template.minPlayers,
    maxPlayers: template.maxPlayers,
    width: template.width,
    height: template.height,
    party: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as RaidRunEntity;
}

describe('StartRaidUseCase', () => {
  let tempDir: string;
  let raidRunsRepository: MockRepository<RaidRunEntity>;
  let partiesService: {
    requirePartyLeader: jest.Mock;
    markPendingRaidForParty: jest.Mock;
  };
  let startRaidUseCase: StartRaidUseCase;
  let template: RaidTemplateDefinition;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'raids-service-'));
    template = createTemplate();
    await writeFile(
      path.join(tempDir, 'raid-templates.json'),
      `${JSON.stringify([template], null, 2)}\n`,
      'utf8',
    );

    raidRunsRepository = createMockRepository<RaidRunEntity>();
    partiesService = {
      requirePartyLeader: jest.fn(),
      markPendingRaidForParty: jest.fn(),
    };

    startRaidUseCase = new StartRaidUseCase(
      raidRunsRepository as never,
      partiesService as never,
      new RaidTemplateFiles(path.join(tempDir, 'raid-templates.json')),
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reuses a recent solo raid that still has free slots', async () => {
    const recentRun = createRun(template, {
      id: 'recent-run',
      playerCount: 2,
      startedAt: new Date(Date.now() - 20_000),
    });
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(recentRun),
    };

    raidRunsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    raidRunsRepository.save.mockImplementation(async (run) => ({
      ...recentRun,
      ...run,
      updatedAt: new Date(),
    }));
    partiesService.requirePartyLeader.mockRejectedValue(new Error('Party not found.'));

    const result = await startRaidUseCase.execute(
      {
        quests: {
          znakomstvo: { status: 'completed' },
        },
      } as unknown as PlayerEntity,
      { templateCode: template.code },
    );

    expect(result.id).toBe('recent-run');
    expect(result.joinedExisting).toBe(true);
    expect(result.playerCount).toBe(3);
    expect(result.template.code).toBe(template.code);
    expect(result.realtimeRoom.options.raidRunId).toBe('recent-run');
    expect(result.realtimeRoom.options.seed).toBe(recentRun.seed);
    expect(raidRunsRepository.create).not.toHaveBeenCalled();
  });

  it('creates a new raid when no recent solo run can be reused', async () => {
    const createdRun = createRun(template, {
      id: 'new-run',
      playerCount: 1,
      seed: 'new-seed',
      startedAt: new Date(),
    });
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    raidRunsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    raidRunsRepository.create.mockImplementation((input) => input);
    raidRunsRepository.save.mockImplementation(async (run) => ({
      ...createdRun,
      ...run,
      createdAt: createdRun.createdAt,
      updatedAt: createdRun.updatedAt,
    }));
    partiesService.requirePartyLeader.mockRejectedValue(new Error('Party not found.'));

    const result = await startRaidUseCase.execute(
      {
        quests: {
          znakomstvo: { status: 'completed' },
        },
      } as unknown as PlayerEntity,
      { templateCode: template.code },
    );

    expect(result.id).toBe('new-run');
    expect(result.joinedExisting).toBe(false);
    expect(result.playerCount).toBe(1);
    expect(result.template.code).toBe(template.code);
    expect(result.realtimeRoom.options.raidRunId).toBe('new-run');
    expect(raidRunsRepository.create).toHaveBeenCalledTimes(1);
    expect(raidRunsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        templateCode: template.code,
        templateName: template.name,
        biome: template.biome,
        minPlayers: template.minPlayers,
        maxPlayers: template.maxPlayers,
        width: template.width,
        height: template.height,
      }),
    );
  });
});
