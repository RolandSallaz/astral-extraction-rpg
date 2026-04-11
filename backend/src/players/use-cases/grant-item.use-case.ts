import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parseInventoryItem, serializeInventoryItem, type ItemId } from '@mmorpg/shared';
import { Repository } from 'typeorm';
import { ItemsService } from '../../items/items.service';
import { GiveItemDto } from '../dto/give-item.dto';
import { PlayerEntity } from '../entities/player.entity';
import { PlayerItemEntity } from '../entities/player-item.entity';
import { PlayerRole } from '../player-role.enum';
import { PlayerInventoryService } from '../player-inventory.service';
import { PlayerSerializerService } from '../player-serializer.service';
import { PlayersService } from '../players.service';

@Injectable()
export class GrantItemUseCase {
  constructor(
    @InjectRepository(PlayerItemEntity)
    private readonly playerItemsRepository: Repository<PlayerItemEntity>,
    private readonly itemsService: ItemsService,
    private readonly playersService: PlayersService,
    private readonly playerInventoryService: PlayerInventoryService,
    private readonly playerSerializer: PlayerSerializerService,
  ) {}

  async execute(adminPlayer: PlayerEntity, input: GiveItemDto) {
    if (adminPlayer.role !== PlayerRole.ADMIN) {
      throw new ForbiddenException('Admin role required.');
    }

    const normalizedNickname = input.nickname.trim().toLowerCase();
    const normalizedItemCode = input.itemCode.trim();
    const targetPlayer = await this.playersService.findByNickname(normalizedNickname);

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

      const updatedPlayer = await this.playersService.findPlayerById(targetPlayer.id);
      return this.playerSerializer.serializePlayer(updatedPlayer);
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

    const updatedPlayer = await this.playersService.findPlayerById(targetPlayer.id);
    return this.playerSerializer.serializePlayer(updatedPlayer);
  }
}
