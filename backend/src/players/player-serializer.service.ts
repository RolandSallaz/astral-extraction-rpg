import { Injectable } from '@nestjs/common';
import {
  canonicalizeItemId,
  INVENTORY_SIZE,
  serializeInventoryItem,
} from '@mmorpg/shared';
import type { CharacterProfile } from '@mmorpg/shared/player/contracts';
import { PlayerEntity } from './entities/player.entity';
import { SerializedPlayer } from './player.types';

const EQUIPMENT_GEM_SLOT_PATTERN = /^(head|body|weapon)-gem-(\d+)$/;

@Injectable()
export class PlayerSerializerService {
  serializePlayer(player: PlayerEntity): SerializedPlayer {
    return {
      id: player.id,
      nickname: player.nickname,
      role: player.role,
      character: {
        equipment: this.buildEquipmentState(player),
        inventory: this.buildInventoryState(player),
        gold: player.gold,
        position: player.position,
        health: player.health,
        maxHealth: player.maxHealth,
        level: player.level,
        experience: player.experience,
        strength: player.strength,
        agility: player.agility,
        intellect: player.intellect,
        quests: player.quests ?? {},
        createdAt: player.createdAt.toISOString(),
        updatedAt: player.updatedAt.toISOString(),
      },
    };
  }

  buildEquipmentState(player: PlayerEntity): CharacterProfile['equipment'] {
    const equipment: CharacterProfile['equipment'] = {};

    for (const item of player.items ?? []) {
      if (!item.equippedSlot || item.parentItemId) {
        continue;
      }

      const equippedSlot = item.equippedSlot as keyof CharacterProfile['equipment'];
      const canonicalItemCode = canonicalizeItemId(item.itemCode);
      if (!canonicalItemCode) {
        continue;
      }

      equipment[equippedSlot] = canonicalItemCode as CharacterProfile['equipment'][typeof equippedSlot];

      if (item.socketedItems?.length) {
        const socketedItems = [...(item.socketedItems ?? [])]
          .filter((socketedItem) => socketedItem.socketIndex !== null && socketedItem.socketIndex !== undefined)
          .sort((left, right) => (left.socketIndex ?? 0) - (right.socketIndex ?? 0));

        socketedItems.forEach((socketedItem, index) => {
          const socketIndex = socketedItem.socketIndex ?? index;
          const socketSlot = `${item.equippedSlot}-gem-${socketIndex + 1}` as keyof CharacterProfile['equipment'];
          const canonicalSocketedCode = canonicalizeItemId(socketedItem.itemCode) ?? socketedItem.itemCode;
          equipment[socketSlot] = canonicalSocketedCode as CharacterProfile['equipment'][typeof socketSlot];
        });
      }
    }

    return equipment;
  }

  buildInventoryState(player: PlayerEntity): CharacterProfile['inventory'] {
    const inventory = Array.from({ length: INVENTORY_SIZE }, () => null) as CharacterProfile['inventory'];

    for (const item of player.items ?? []) {
      if (item.parentItemId || item.inventorySlot === null || item.inventorySlot === undefined) {
        continue;
      }

      if (item.inventorySlot >= 0 && item.inventorySlot < inventory.length) {
        const canonicalItemCode = canonicalizeItemId(item.itemCode);
        if (!canonicalItemCode) {
          continue;
        }

        const socketedCodes = [...(item.socketedItems ?? [])]
          .filter((socketedItem) => socketedItem.socketIndex !== null && socketedItem.socketIndex !== undefined)
          .sort((left, right) => (left.socketIndex ?? 0) - (right.socketIndex ?? 0))
          .map((socketedItem) => socketedItem.itemCode);
        inventory[item.inventorySlot] = serializeInventoryItem(canonicalItemCode, item.quantity, socketedCodes);
      }
    }

    return inventory;
  }

  isEquipmentGemSlot(slot: string) {
    return EQUIPMENT_GEM_SLOT_PATTERN.test(slot);
  }
}
