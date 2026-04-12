import { ForbiddenException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GameConfigsService } from './game-configs.service';
import { PlayerRole } from '../players/player-role.enum';

describe('GameConfigsService', () => {
  async function createService() {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mmorpg-game-configs-'));
    return {
      tempDir,
      service: GameConfigsService.forRootDir(tempDir),
    };
  }

  it('rejects non-admin skill balance updates', async () => {
    const { service, tempDir } = await createService();

    await expect(
      service.updateSkillBalance(
        { role: PlayerRole.USER } as any,
        { fireball: { damage: 20 } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates and clamps skill balance updates for admin users', async () => {
    const { service, tempDir } = await createService();

    const result = await service.updateSkillBalance(
      { role: PlayerRole.ADMIN } as any,
      {
        fireball: { damage: -5, burnDamage: 3.8, burnTicks: 2.2 },
        fireNova: { damage: 11.9 },
      },
    );

    expect(result.fireball.damage).toBe(0);
    expect(result.fireball.burnDamage).toBe(3);
    expect(result.fireball.burnTicks).toBe(2);
    expect(result.fireNova.damage).toBe(11);

    const saved = JSON.parse(await readFile(path.join(tempDir, 'skill-balance.json'), 'utf8'));
    expect(saved.fireball.damage).toBe(0);

    await rm(tempDir, { recursive: true, force: true });
  });

  it('clamps mob balance values and keeps health at minimum 1', async () => {
    const { service, tempDir } = await createService();

    const result = await service.updateMobBalance(
      { role: PlayerRole.ADMIN } as any,
      {
        rat: { maxHealth: 0, moveSpeed: -10, attackDamage: 8.9 },
        bat: { experienceReward: -5, leashRange: 199.9 },
      },
    );

    expect(result.rat.maxHealth).toBe(1);
    expect(result.rat.moveSpeed).toBe(0);
    expect(result.rat.attackDamage).toBe(8);
    expect(result.bat.experienceReward).toBe(0);
    expect(result.bat.leashRange).toBe(199);

    await rm(tempDir, { recursive: true, force: true });
  });

  it('normalizes mob visuals and persists only valid clip references for admins', async () => {
    const { service, tempDir } = await createService();

    const result = await service.updateMobVisuals(
      { role: PlayerRole.ADMIN } as any,
      {
        rat: {
          spriteScale: 0,
          anchorY: 2,
          clips: {
            idle_basic: {
              spritesheet: 'mobs/rat.png',
              frameWidth: 0,
              frameHeight: 24.7,
              columns: 0,
              startFrame: -2,
              endFrame: 3.9,
              frameRate: 0,
              repeat: -1,
            },
          },
          states: {
            idle: 'idle_basic',
            attack: 'missing_clip',
          },
        },
      },
    );

    expect(result.rat.spriteScale).toBe(0.1);
    expect(result.rat.anchorY).toBe(1.5);
    expect(result.rat.clips.idle_basic).toEqual({
      key: 'idle_basic',
      spritesheet: 'mobs/rat.png',
      frameWidth: 1,
      frameHeight: 24,
      columns: 1,
      startFrame: 0,
      endFrame: 3,
      frameRate: 1,
      repeat: -1,
    });
    expect(result.rat.states).toEqual({ idle: 'idle_basic' });

    const saved = JSON.parse(await readFile(path.join(tempDir, 'mob-visuals.json'), 'utf8'));
    expect(saved.rat.states).toEqual({ idle: 'idle_basic' });

    await rm(tempDir, { recursive: true, force: true });
  });
});
