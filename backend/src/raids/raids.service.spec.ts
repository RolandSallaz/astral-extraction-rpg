import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { RaidTemplateDefinition } from '@mmorpg/shared/raids/templates';
import { RaidTemplateFiles } from './raid-template-files';
import type { RaidRunEntity } from './entities/raid-run.entity';
import type { PlayerEntity } from '../players/entities/player.entity';
import { StartRaidUseCase } from './use-cases/start-raid.use-case';

type MockRepository = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const NON_TUTORIAL_RAID_SIZE_SCALE = 2;

function createMockRepository(): MockRepository {
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

function scaleTemplate(template: RaidTemplateDefinition): RaidTemplateDefinition {
  if (template.code === 'crypt_small') {
    return template;
  }

  return {
    ...template,
    width: template.width * NON_TUTORIAL_RAID_SIZE_SCALE,
    height: template.height * NON_TUTORIAL_RAID_SIZE_SCALE,
  };
}

function createRun(
  template: RaidTemplateDefinition,
  overrides: Partial<RaidRunEntity> = {},
): RaidRunEntity {
  const now = new Date();
  const scaledTemplate = scaleTemplate(template);
  return {
    id: 'run-1',
    seed: 'shared-seed',
    status: 'ready',
    playerCount: 2,
    generatedLayout: {
      width: scaledTemplate.width,
      height: scaledTemplate.height,
      rooms: [],
      spawnPoints: [],
      chests: [],
      exitPoints: [],
    },
    runtimeState: null,
    runtimeStateUpdatedAt: null,
    startedAt: now,
    finishedAt: null,
    templateCode: scaledTemplate.code,
    templateName: scaledTemplate.name,
    biome: scaledTemplate.biome,
    minPlayers: scaledTemplate.minPlayers,
    maxPlayers: scaledTemplate.maxPlayers,
    width: scaledTemplate.width,
    height: scaledTemplate.height,
    partyId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as RaidRunEntity;
}

describe('StartRaidUseCase', () => {
  let tempDir: string;
  let raidRunsRepository: MockRepository;
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

    raidRunsRepository = createMockRepository();
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
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(recentRun),
    };

    raidRunsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    raidRunsRepository.save.mockImplementation(async (run: Partial<RaidRunEntity>) => ({
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
    expect(result.generatedLayout).toBeNull();
    expect(result.realtimeRoom.options.raidRunId).toBe('recent-run');
    expect(result.realtimeRoom.options.seed).toBe(recentRun.seed);
    expect(raidRunsRepository.create).not.toHaveBeenCalled();
  });

  it('reuses an active raid started less than a minute ago', async () => {
    const activeRun = createRun(template, {
      id: 'active-run',
      status: 'active',
      playerCount: 1,
      startedAt: new Date(Date.now() - 35_000),
    });
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(activeRun),
    };

    raidRunsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    raidRunsRepository.save.mockImplementation(async (run: Partial<RaidRunEntity>) => ({
      ...activeRun,
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

    expect(result.id).toBe('active-run');
    expect(result.joinedExisting).toBe(true);
    expect(result.playerCount).toBe(2);
    expect(result.realtimeRoom.options.raidRunId).toBe('active-run');
    expect(raidRunsRepository.create).not.toHaveBeenCalled();
  });

  it('marks the whole party with the reused raid when joining an existing run', async () => {
    const recentRun = createRun(template, {
      id: 'party-reused-run',
      status: 'active',
      playerCount: 1,
      startedAt: new Date(Date.now() - 20_000),
    });
    const party = {
      id: 'party-1',
      members: [{ id: 'leader' }, { id: 'member-2' }],
    };
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(recentRun),
    };

    raidRunsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    raidRunsRepository.save.mockImplementation(async (run: Partial<RaidRunEntity>) => ({
      ...recentRun,
      ...run,
      updatedAt: new Date(),
    }));
    partiesService.requirePartyLeader.mockResolvedValue(party);

    const result = await startRaidUseCase.execute(
      {
        quests: {
          znakomstvo: { status: 'completed' },
        },
      } as unknown as PlayerEntity,
      { templateCode: template.code },
    );

    expect(result.id).toBe('party-reused-run');
    expect(result.joinedExisting).toBe(true);
    expect(result.playerCount).toBe(3);
    expect(partiesService.markPendingRaidForParty).toHaveBeenCalledTimes(1);
    expect(partiesService.markPendingRaidForParty).toHaveBeenCalledWith(
      'party-1',
      expect.objectContaining({
        raidRunId: 'party-reused-run',
        startedAt: recentRun.startedAt?.toISOString() ?? null,
        realtimeRoom: expect.objectContaining({
          roomName: 'raid',
          options: expect.objectContaining({
            raidRunId: 'party-reused-run',
            templateCode: template.code,
            seed: recentRun.seed,
          }),
        }),
      }),
    );
  });

  it('creates a new raid when no recent solo run can be reused', async () => {
    const createdRun = createRun(template, {
      id: 'new-run',
      playerCount: 1,
      seed: 'new-seed',
      startedAt: new Date(),
    });
    const scaledTemplate = scaleTemplate(template);
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    raidRunsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    raidRunsRepository.create.mockImplementation((input: Partial<RaidRunEntity>) => input);
    raidRunsRepository.save.mockImplementation(async (run: Partial<RaidRunEntity>) => ({
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
    expect(result.generatedLayout).toBeNull();
    expect(result.realtimeRoom.options.raidRunId).toBe('new-run');
    expect(raidRunsRepository.create).toHaveBeenCalledTimes(1);
    expect(raidRunsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        generatedLayout: null,
        templateCode: scaledTemplate.code,
        templateName: scaledTemplate.name,
        biome: scaledTemplate.biome,
        minPlayers: scaledTemplate.minPlayers,
        maxPlayers: scaledTemplate.maxPlayers,
        width: scaledTemplate.width,
        height: scaledTemplate.height,
      }),
    );
  });
});
