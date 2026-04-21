import { PlayerInventoryService } from './player-inventory.service';
import { PlayerRole } from './player-role.enum';
import { PlayerSerializerService } from './player-serializer.service';
import { parseInventoryItem, serializeInventoryItem } from '@mmorpg/shared';

describe('Player inventory and serialization helpers', () => {
  function createInventoryService() {
    const playerItemsRepository = {
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => value),
      delete: jest.fn(async () => undefined),
    };
    const itemsService = {
      findByCodes: jest.fn(),
      findByCode: jest.fn(),
    };

    return {
      service: new PlayerInventoryService(
        playerItemsRepository as any,
        itemsService as any,
      ),
      playerItemsRepository,
      itemsService,
    };
  }

  it('ignores socketed gems while gems are disabled', () => {
    const serialized = serializeInventoryItem('wood_staff', 1, ['fire_trail_gem', 'critical_gem']);
    const parsed = parseInventoryItem(serialized);

    expect(serialized).toBe('wood_staff');
    expect(parsed).toEqual(expect.objectContaining({
      itemId: 'wood_staff',
      quantity: 1,
      socketedGemCodes: [],
    }));
  });

  it('migrates legacy default_staff inventory codes to wood_staff', () => {
    const parsed = parseInventoryItem('default_staff@@fire_return_gem');

    expect(parsed).toEqual(expect.objectContaining({
      itemId: 'wood_staff',
      socketedGemCodes: [],
    }));
  });

  it('builds equipment and inventory state without disabled socketed weapon gems', () => {
    const service = new PlayerSerializerService();
    const player = {
      id: 'player-1',
      nickname: 'mage',
      passwordHash: 'hash',
      role: PlayerRole.USER,
      position: { x: 0, y: 0 },
      health: 100,
      maxHealth: 100,
      level: 1,
      experience: 0,
      strength: 1,
      agility: 1,
      intellect: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          equippedSlot: 'weapon',
          inventorySlot: null,
          parentItemId: null,
          quantity: 1,
          itemCode: 'default_staff',
          socketedItems: [
            { socketIndex: 1, itemCode: 'critical_gem' },
            { socketIndex: 0, itemCode: 'fire_trail_gem' },
          ],
        },
        {
          equippedSlot: null,
          inventorySlot: 3,
          parentItemId: null,
          quantity: 2,
          itemCode: 'default_staff',
          socketedItems: [
            { socketIndex: 0, itemCode: 'fire_return_gem' },
          ],
        },
      ],
    };

    expect(service.buildEquipmentState(player as any)).toEqual({
      weapon: 'wood_staff',
    });
    expect(service.buildInventoryState(player as any)[3]).toBe('wood_staff');
  });

  it('does not sync disabled socket children into separate player items', async () => {
    const { service, playerItemsRepository, itemsService } = createInventoryService();
    const savedBaseItems = [
      { id: 'weapon-item', equippedSlot: 'weapon', inventorySlot: null },
      { id: 'inventory-staff', equippedSlot: null, inventorySlot: 0 },
    ];

    itemsService.findByCodes.mockResolvedValue([
      { id: 'wood_staff', stackable: false, maxStack: 1 },
    ]);
    playerItemsRepository.save
      .mockResolvedValueOnce(savedBaseItems)
      .mockImplementationOnce(async (value) => value);

    await service.syncPlayerItems(
      'player-1',
      {
        weapon: 'wood_staff',
        'weapon-gem-1': 'fire_trail_gem',
        'weapon-gem-2': 'critical_gem',
      },
      {},
      ['wood_staff@@fire_return_gem', null],
    );

    expect(playerItemsRepository.delete).toHaveBeenCalledWith({ playerId: 'player-1' });
    expect(playerItemsRepository.save).toHaveBeenCalledTimes(1);
  });
});
