import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerEntity } from './entities/player.entity';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { CreatePlayerInput } from './player.types';
import { PlayerRole } from './player-role.enum';
import { PlayerInventoryService } from './player-inventory.service';
import { PlayerSerializerService } from './player-serializer.service';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(PlayerEntity)
    private readonly playersRepository: Repository<PlayerEntity>,
    private readonly playerInventoryService: PlayerInventoryService,
    private readonly playerSerializer: PlayerSerializerService,
  ) {}

  async findByNickname(nickname: string) {
    return this.playersRepository.findOne({
      where: { nickname },
      relations: {
        items: {
          socketedItems: true,
        },
      },
    });
  }

  async createPlayer(input: CreatePlayerInput) {
    const player = this.playersRepository.create({
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      role: input.role ?? PlayerRole.USER,
      position: {
        x: 0,
        y: 0,
      },
      gold: 250,
      health: 100,
      maxHealth: 100,
      level: 1,
      experience: 0,
      strength: 1,
      agility: 1,
      intellect: 1,
      quests: {},
    });

    const savedPlayer = await this.playersRepository.save(player);
    return this.findPlayerById(savedPlayer.id);
  }

  async updatePlayer(player: PlayerEntity, input: UpdatePlayerDto) {
    if (input.equipment || input.inventory) {
      await this.playerInventoryService.syncPlayerItems(
        player.id,
        input.equipment ?? this.playerSerializer.buildEquipmentState(player),
        input.inventory ?? this.playerSerializer.buildInventoryState(player),
      );
    }

    const patch = {
      ...(typeof input.gold === 'number' ? { gold: input.gold } : {}),
      ...(typeof input.health === 'number' ? { health: input.health } : {}),
      ...(typeof input.maxHealth === 'number' ? { maxHealth: input.maxHealth } : {}),
      ...(typeof input.level === 'number' ? { level: input.level } : {}),
      ...(typeof input.experience === 'number' ? { experience: input.experience } : {}),
      ...(typeof input.strength === 'number' ? { strength: input.strength } : {}),
      ...(typeof input.agility === 'number' ? { agility: input.agility } : {}),
      ...(typeof input.intellect === 'number' ? { intellect: input.intellect } : {}),
      ...(input.quests ? { quests: input.quests } : {}),
    };

    if (Object.keys(patch).length > 0) {
      await this.playersRepository.update(
        { id: player.id },
        patch,
      );
    }

    return this.findPlayerById(player.id);
  }

  async findPlayerById(playerId: string) {
    return this.playersRepository.findOneOrFail({
      where: { id: playerId },
      relations: {
        items: {
          socketedItems: true,
        },
      },
    });
  }
}
