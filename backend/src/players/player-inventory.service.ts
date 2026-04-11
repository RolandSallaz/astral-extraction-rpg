import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  parseInventoryItem,
  type CharacterProfile,
} from '@mmorpg/shared';
import { Repository } from 'typeorm';
import { ItemsService } from '../items/items.service';
import { PlayerItemEntity } from './entities/player-item.entity';

const EQUIPMENT_GEM_SLOT_PATTERN = /^(head|body|weapon)-gem-(\d+)$/;

@Injectable()
export class PlayerInventoryService {
  constructor(
    @InjectRepository(PlayerItemEntity)
    private readonly playerItemsRepository: Repository<PlayerItemEntity>,
    private readonly itemsService: ItemsService,
  ) {}

  async syncPlayerItems(
    playerId: string,
    equipment: CharacterProfile['equipment'],
    inventory: CharacterProfile['inventory'],
  ) {
    const equipmentCodes = Object.values(equipment).flatMap((value) => (value ? [value] : []));
    const requestedCodes = [
      ...equipmentCodes,
      ...inventory
        .flatMap((value) => {
          const parsed = parseInventoryItem(value);
          return parsed ? [parsed.itemId, ...parsed.socketedGemCodes] : [];
        })
        .flatMap((value) => (value ? [value] : [])),
    ];
    const uniqueCodes = [...new Set(requestedCodes)];
    const equippedSocketGemEntries = Object.entries(equipment).flatMap((entry) => {
      const [slot, code] = entry;
      const match = slot.match(EQUIPMENT_GEM_SLOT_PATTERN);
      if (!match || !code) {
        return [];
      }

      return [{
        parentSlot: match[1],
        socketIndex: Math.max(0, Number.parseInt(match[2] ?? '1', 10) - 1),
        code,
      }];
    });

    const itemDefinitions = await this.itemsService.findByCodes(uniqueCodes);
    const definitionByCode = new Map<string, (typeof itemDefinitions)[number]>(itemDefinitions.map((definition) => [definition.id, definition]));

    await this.playerItemsRepository.delete({ playerId });

    const baseItems: PlayerItemEntity[] = [];

    Object.entries(equipment).forEach(([slot, code]) => {
      if (!code || EQUIPMENT_GEM_SLOT_PATTERN.test(slot)) {
        return;
      }

      const itemDefinition = definitionByCode.get(code);
      if (!itemDefinition) {
        return;
      }

      baseItems.push(
        this.playerItemsRepository.create({
          playerId,
          itemCode: itemDefinition.id,
          equippedSlot: slot,
          inventorySlot: null,
          parentItemId: null,
          socketIndex: null,
          quantity: 1,
        }),
      );
    });

    const pendingInventorySocketChildren: Array<{ inventorySlot: number; socketCode: string; socketIndex: number }> = [];

    inventory.forEach((value, index) => {
      if (!value) {
        return;
      }

      const parsed = parseInventoryItem(value);
      if (!parsed) {
        return;
      }

      const itemDefinition = definitionByCode.get(parsed.itemId);
      if (!itemDefinition) {
        return;
      }

      baseItems.push(
        this.playerItemsRepository.create({
          playerId,
          itemCode: itemDefinition.id,
          equippedSlot: null,
          inventorySlot: index,
          parentItemId: null,
          socketIndex: null,
          quantity: itemDefinition.stackable ? Math.max(1, Math.min(itemDefinition.maxStack ?? 1, parsed.quantity)) : 1,
        }),
      );

      parsed.socketedGemCodes.forEach((socketCode, socketIndex) => {
        pendingInventorySocketChildren.push({
          inventorySlot: index,
          socketCode,
          socketIndex,
        });
      });
    });

    const savedBaseItems = baseItems.length
      ? await this.playerItemsRepository.save(baseItems)
      : [];

    const socketedItems: PlayerItemEntity[] = [];
    const equippedItemBySlot = new Map(
      savedBaseItems
        .filter((item) => item.equippedSlot)
        .map((item) => [item.equippedSlot as string, item]),
    );

    equippedSocketGemEntries.forEach(({ parentSlot, socketIndex, code }) => {
      const parentItem = equippedItemBySlot.get(parentSlot);
      const itemDefinition = definitionByCode.get(code);
      if (!parentItem || !itemDefinition) {
        return;
      }

      socketedItems.push(
        this.playerItemsRepository.create({
          playerId,
          itemCode: itemDefinition.id,
          equippedSlot: null,
          inventorySlot: null,
          parentItemId: parentItem.id,
          socketIndex,
          quantity: 1,
        }),
      );
    });

    const inventoryItemBySlot = new Map(
      savedBaseItems
        .filter((item) => item.inventorySlot !== null && item.inventorySlot !== undefined)
        .map((item) => [item.inventorySlot as number, item]),
    );

    const inventorySocketedItems = pendingInventorySocketChildren.flatMap(({ inventorySlot, socketCode, socketIndex }) => {
      const parentItem = inventoryItemBySlot.get(inventorySlot);
      const socketDefinition = definitionByCode.get(socketCode);
      if (!parentItem || !socketDefinition) {
        return [];
      }

      return [
        this.playerItemsRepository.create({
          playerId,
          itemCode: socketDefinition.id,
          equippedSlot: null,
          inventorySlot: null,
          parentItemId: parentItem.id,
          socketIndex,
          quantity: 1,
        }),
      ];
    });

    const allSocketedItems = [...socketedItems, ...inventorySocketedItems];
    if (allSocketedItems.length) {
      await this.playerItemsRepository.save(allSocketedItems);
    }
  }
}
