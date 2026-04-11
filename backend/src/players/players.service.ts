import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  parseInventoryItem,
  serializeInventoryItem,
  type ItemId,
} from '@mmorpg/shared';
import { Repository } from 'typeorm';
import { ItemsService } from '../items/items.service';
import { PlayerEntity } from './entities/player.entity';
import { PlayerItemEntity } from './entities/player-item.entity';
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
    @InjectRepository(PlayerItemEntity)
    private readonly playerItemsRepository: Repository<PlayerItemEntity>,
    private readonly itemsService: ItemsService,
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

    if (input.position) {
      await this.playersRepository.update(
        { id: player.id },
        {
          position: input.position,
          ...(typeof input.gold === 'number' ? { gold: input.gold } : {}),
          ...(typeof input.health === 'number' ? { health: input.health } : {}),
          ...(typeof input.maxHealth === 'number' ? { maxHealth: input.maxHealth } : {}),
          ...(typeof input.level === 'number' ? { level: input.level } : {}),
          ...(typeof input.experience === 'number' ? { experience: input.experience } : {}),
          ...(typeof input.strength === 'number' ? { strength: input.strength } : {}),
          ...(typeof input.agility === 'number' ? { agility: input.agility } : {}),
          ...(typeof input.intellect === 'number' ? { intellect: input.intellect } : {}),
          ...(input.quests ? { quests: input.quests } : {}),
        },
      );
    } else if (
      typeof input.gold === 'number' ||
      typeof input.health === 'number' ||
      typeof input.maxHealth === 'number' ||
      typeof input.level === 'number' ||
      typeof input.experience === 'number' ||
      typeof input.strength === 'number' ||
      typeof input.agility === 'number' ||
      typeof input.intellect === 'number' ||
      Boolean(input.quests)
    ) {
      await this.playersRepository.update(
        { id: player.id },
        {
          ...(typeof input.gold === 'number' ? { gold: input.gold } : {}),
          ...(typeof input.health === 'number' ? { health: input.health } : {}),
          ...(typeof input.maxHealth === 'number' ? { maxHealth: input.maxHealth } : {}),
          ...(typeof input.level === 'number' ? { level: input.level } : {}),
          ...(typeof input.experience === 'number' ? { experience: input.experience } : {}),
          ...(typeof input.strength === 'number' ? { strength: input.strength } : {}),
          ...(typeof input.agility === 'number' ? { agility: input.agility } : {}),
          ...(typeof input.intellect === 'number' ? { intellect: input.intellect } : {}),
          ...(input.quests ? { quests: input.quests } : {}),
        },
      );
    }

    return this.findPlayerById(player.id);
  }

  async giveItemToPlayer(adminPlayer: PlayerEntity, nickname: string, itemCode: string) {
    if (adminPlayer.role !== PlayerRole.ADMIN) {
      throw new ForbiddenException('Admin role required.');
    }

    const normalizedNickname = nickname.trim().toLowerCase();
    const normalizedItemCode = itemCode.trim();
    const targetPlayer = await this.findByNickname(normalizedNickname);

    if (!targetPlayer) {
      throw new NotFoundException('Player not found.');
    }

    const itemDefinition = await this.itemsService.findByCode(normalizedItemCode);
    if (!itemDefinition) {
      throw new NotFoundException('Item template not found.');
    }

    const inventory = this.playerSerializer.buildInventoryState(targetPlayer);
    const stackSlotIndex =
      itemDefinition.stackable && itemDefinition.maxStack > 1
        ? inventory.findIndex((value) => {
            const parsed = parseInventoryItem(value);
            return parsed?.itemId === itemDefinition.code && parsed.quantity < itemDefinition.maxStack;
          })
        : -1;

    if (stackSlotIndex !== -1) {
      const parsed = parseInventoryItem(inventory[stackSlotIndex]);
      const nextInventory = [...inventory];
      nextInventory[stackSlotIndex] = serializeInventoryItem(
        itemDefinition.code as ItemId,
        Math.min(itemDefinition.maxStack, (parsed?.quantity ?? 1) + 1),
      );
      await this.playerInventoryService.syncPlayerItems(
        targetPlayer.id,
        this.playerSerializer.buildEquipmentState(targetPlayer),
        nextInventory,
      );
      return this.findPlayerById(targetPlayer.id);
    }

    const firstEmptySlot = inventory.findIndex((value) => value === null);
    if (firstEmptySlot === -1) {
      throw new ForbiddenException('Target inventory is full.');
    }

    await this.playerItemsRepository.save(
      this.playerItemsRepository.create({
        playerId: targetPlayer.id,
        itemCode: itemDefinition.code,
        equippedSlot: null,
        inventorySlot: firstEmptySlot,
        quantity: 1,
      }),
    );

    return this.findPlayerById(targetPlayer.id);
  }
  private async findPlayerById(playerId: string) {
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
