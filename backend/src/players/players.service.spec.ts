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

  it('serializes and parses stacked inventory entries with socketed gems', () => {
    const serialized = serializeInventoryItem('default_staff', 2, ['fire_trail_gem', 'critical_gem']);
    const parsed = parseInventoryItem(serialized);

    expect(serialized).toBe('default_staff@@fire_trail_gem,critical_gem');
    expect(parsed).toEqual(expect.objectContaining({
      itemId: 'default_staff',
      quantity: 1,
      socketedGemCodes: ['fire_trail_gem', 'critical_gem'],
    }));
  });

  it('builds equipment and inventory state including socketed weapon gems', () => {
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
      weapon: 'default_staff',
      'weapon-gem-1': 'fire_trail_gem',
      'weapon-gem-2': 'critical_gem',
    });
    expect(service.buildInventoryState(player as any)[3]).toBe('default_staff@@fire_return_gem');
  });

  it('syncs weapon and inventory socket children into separate player items', async () => {
    const { service, playerItemsRepository, itemsService } = createInventoryService();
    const savedBaseItems = [
      { id: 'weapon-item', equippedSlot: 'weapon', inventorySlot: null },
      { id: 'inventory-staff', equippedSlot: null, inventorySlot: 0 },
    ];

    itemsService.findByCodes.mockResolvedValue([
      { code: 'default_staff', stackable: false, maxStack: 1 },
      { code: 'fire_trail_gem', stackable: false, maxStack: 1 },
      { code: 'critical_gem', stackable: false, maxStack: 1 },
      { code: 'fire_return_gem', stackable: false, maxStack: 1 },
    ]);
    playerItemsRepository.save
      .mockResolvedValueOnce(savedBaseItems)
      .mockImplementationOnce(async (value) => value);

    await service.syncPlayerItems(
      'player-1',
      {
        weapon: 'default_staff',
        'weapon-gem-1': 'fire_trail_gem',
        'weapon-gem-2': 'critical_gem',
      },
      ['default_staff@@fire_return_gem', null],
    );

    expect(playerItemsRepository.delete).toHaveBeenCalledWith({ playerId: 'player-1' });
    expect(playerItemsRepository.save).toHaveBeenCalledTimes(2);

    const socketChildren = playerItemsRepository.save.mock.calls[1][0];
    expect(socketChildren).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parentItemId: 'weapon-item', socketIndex: 0, itemCode: 'fire_trail_gem' }),
        expect.objectContaining({ parentItemId: 'weapon-item', socketIndex: 1, itemCode: 'critical_gem' }),
        expect.objectContaining({ parentItemId: 'inventory-staff', socketIndex: 0, itemCode: 'fire_return_gem' }),
      ]),
    );
  });
});
