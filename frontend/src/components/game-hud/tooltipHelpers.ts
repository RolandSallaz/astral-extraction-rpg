import {
  DEFAULT_ITEM_BALANCE_CONFIG,
  getResolvedItemTooltipStats,
  getResolvedItemValue,
  type ItemBalanceConfig,
} from '@/lib/itemBalance';
import {
  getItemProgressionBonuses,
  resolveWoodStaffStrikeCooldownMs,
  resolveWoodStaffStrikeDamage,
  SKILL_REGISTRY,
  WOOD_STAFF_CHAIN_STRIKE_BASE_BOUNCE_RADIUS_PX,
  WOOD_STAFF_CHAIN_STRIKE_BASE_HIT_COUNT,
  WORLD_GAMEPLAY_PROFILE,
  type ItemProgressionState,
} from '@mmorpg/shared';
import {
  EQUIPMENT_ITEMS,
  getInventoryItemId,
  parseInventoryItem,
} from '@/lib/items/equipmentItems';
import type { SkillId } from '@/components/game-hud/types';
import { SKILL_TOOLTIP_STATS } from '@/components/game-hud/skillConstants';

export function getSafeTooltipPosition(
  pointerX: number,
  pointerY: number,
  width: number,
  height: number,
) {
  if (typeof window === 'undefined') {
    return {
      left: pointerX + 16,
      top: pointerY + 16,
    };
  }

  const margin = 20;
  const horizontalOffset = 16;
  const verticalOffset = 16;
  const preferredRightLeft = pointerX + horizontalOffset;
  const preferredBottomTop = pointerY + verticalOffset;
  const preferredLeftLeft = pointerX - width - horizontalOffset;
  const preferredTopTop = pointerY - height - verticalOffset;
  const left =
    preferredRightLeft + width <= window.innerWidth - margin
      ? preferredRightLeft
      : preferredLeftLeft >= margin
        ? preferredLeftLeft
        : Math.min(
            Math.max(margin, preferredRightLeft),
            Math.max(margin, window.innerWidth - width - margin),
          );
  const top =
    preferredBottomTop + height <= window.innerHeight - margin
      ? preferredBottomTop
      : preferredTopTop >= margin
        ? preferredTopTop
        : Math.min(
            Math.max(margin, preferredBottomTop),
            Math.max(margin, window.innerHeight - height - margin),
          );

  return {
    left,
    top,
  };
}

export function formatGoldValue(value: number) {
  return `${Math.max(0, Math.floor(value))}g`;
}

export function getDisplayItemName(itemValue: string) {
  const parsed = parseInventoryItem(itemValue);
  if (!parsed) {
    return 'Unknown Item';
  }

  return parsed.raidUnidentified ? 'Unidentified Potion' : EQUIPMENT_ITEMS[parsed.itemId].name;
}

export function getDisplayItemTooltipLines(
  itemValue: string,
  itemBalanceConfig: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
  itemProgression?: ItemProgressionState | null,
) {
  const parsed = parseInventoryItem(itemValue);
  if (!parsed) {
    return ['Unknown item'];
  }

  if (parsed.raidUnidentified) {
    return [
      'Raid potion',
      'Effect is unknown until identified',
      'Identify by finding another of the same type or by extracting',
    ];
  }

  const item = EQUIPMENT_ITEMS[parsed.itemId as keyof typeof EQUIPMENT_ITEMS];
  if (!item) {
    return ['Unknown item'];
  }

  const resolvedProgression = itemProgression ?? parsed.itemProgression ?? null;
  const dynamicLines = getDynamicItemTooltipLines(item.id, resolvedProgression);

  return [
    ...getResolvedItemTooltipStats(item.id, itemBalanceConfig),
    ...dynamicLines,
    `Value: ${formatGoldValue(getResolvedItemValue(item.id, itemBalanceConfig))}`,
  ];
}

export function getItemTooltipLines(
  itemId: string,
  itemBalanceConfig: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
  itemProgression?: ItemProgressionState | null,
) {
  return getDisplayItemTooltipLines(itemId, itemBalanceConfig, itemProgression);
}

function formatSeconds(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function formatTilesFromPixels(pixels: number) {
  return `${(pixels / WORLD_GAMEPLAY_PROFILE.tileSize).toFixed(2)} tiles`;
}

function getDynamicItemTooltipLines(
  itemId: string,
  itemProgression: ItemProgressionState | null | undefined,
) {
  switch (itemId) {
    case 'wood_staff': {
      const bonuses = getItemProgressionBonuses(itemId, itemProgression);
      const chainStrikeCooldownMs = SKILL_REGISTRY.woodStaffChainStrike.baseCooldownMs;
      const strikeDamage = resolveWoodStaffStrikeDamage(WORLD_GAMEPLAY_PROFILE.meleeStrikeDamage, bonuses);
      const strikeRangePx = WORLD_GAMEPLAY_PROFILE.meleeStrikeRange + bonuses.meleeStrikeRangeBonusPx;
      const strikeCooldownMs = resolveWoodStaffStrikeCooldownMs(WORLD_GAMEPLAY_PROFILE.meleeStrikeCooldownMs, bonuses);

      const lines = [
        `Strike damage: ${strikeDamage}`,
        `Strike range: ${formatTilesFromPixels(strikeRangePx)}`,
        `Strike cooldown: ${formatSeconds(strikeCooldownMs)}`,
        `Strike knockback: ${bonuses.woodStaffStrikeKnockbackBonusTiles > 0 ? `+${bonuses.woodStaffStrikeKnockbackBonusTiles.toFixed(1)} tile` : 'none'}`,
        `Strike slow: ${bonuses.woodStaffStrikeSlowDurationMs > 0 ? formatSeconds(bonuses.woodStaffStrikeSlowDurationMs) : 'none'}`,
      ];
      if (bonuses.woodStaffStrikeAoeSplashEnabled) lines.push('AoE splash: active (50% damage)');
      if (bonuses.woodStaffStrikeHealOnHit > 0) lines.push(`Heal on hit: +${bonuses.woodStaffStrikeHealOnHit} HP`);
      lines.push(`Dash skill: ${bonuses.grantsWoodStaffDash ? `unlocked (${formatSeconds(WORLD_GAMEPLAY_PROFILE.woodStaffDashCooldownMs)})` : 'locked'}`);
      lines.push(`Area skill: ${bonuses.grantsWoodStaffSlam ? `unlocked (${formatSeconds(WORLD_GAMEPLAY_PROFILE.woodStaffSlamCooldownMs)})` : 'locked'}`);
      lines.push(
        `Chain Strike: ${bonuses.grantsWoodStaffChainStrike
          ? `unlocked (${WOOD_STAFF_CHAIN_STRIKE_BASE_HIT_COUNT + bonuses.woodStaffChainStrikeBonusHits} hits, ${formatSeconds(chainStrikeCooldownMs)})`
          : 'locked'}`,
      );
      if (bonuses.woodStaffChainStrikeRangeBonusPx > 0) lines.push(`Chain start range: +${formatTilesFromPixels(bonuses.woodStaffChainStrikeRangeBonusPx)}`);
      if (bonuses.woodStaffChainStrikeBounceRadiusBonusPx > 0) lines.push(`Chain search radius: +${formatTilesFromPixels(bonuses.woodStaffChainStrikeBounceRadiusBonusPx)}`);
      if (bonuses.woodStaffChainStrikeRefundChance > 0) lines.push(`Chain bounce refund: ${Math.round(bonuses.woodStaffChainStrikeRefundChance * 100)}%`);
      if (bonuses.grantsWoodStaffSpectralVolley) {
        const boltCount = 3 + bonuses.woodStaffSpectralVolleyBonusBolts;
        const volleyDesc = [`${boltCount} bolts`];
        if (bonuses.woodStaffSpectralVolleySpreadBonusDeg > 0) volleyDesc.push(`+${bonuses.woodStaffSpectralVolleySpreadBonusDeg}° spread`);
        if (bonuses.woodStaffSpectralVolleyPiercing) volleyDesc.push('piercing');
        if (bonuses.woodStaffSpectralVolleyRefundChance > 0) volleyDesc.push(`${Math.round(bonuses.woodStaffSpectralVolleyRefundChance * 100)}% echo`);
        lines.push(`Spectral Volley: ${volleyDesc.join(', ')} (3.00s)`);
      } else {
        lines.push('Spectral Volley: locked');
      }
      return lines;
    }
    default:
      return [];
  }
}

export function getDisplayItemCategory(itemValue: string) {
  const itemId = getInventoryItemId(itemValue);
  return itemId ? (EQUIPMENT_ITEMS[itemId].slot ?? EQUIPMENT_ITEMS[itemId].type) : 'item';
}

export function getSkillTooltipLines(
  skillId: SkillId,
  weaponItemId: string | null | undefined,
  itemProgression: ItemProgressionState | null | undefined,
): string[] {
  switch (skillId) {
    case 'woodStaffStrike': {
      const bonuses = getItemProgressionBonuses(weaponItemId, itemProgression);
      const cooldownMs = resolveWoodStaffStrikeCooldownMs(WORLD_GAMEPLAY_PROFILE.meleeStrikeCooldownMs, bonuses);
      return ['Close-range strike', `Cooldown: ${formatSeconds(cooldownMs)}`];
    }
    case 'woodStaffDash': {
      return ['Dash like a skeleton', 'Physical hit on impact', `Cooldown: ${formatSeconds(WORLD_GAMEPLAY_PROFILE.woodStaffDashCooldownMs)}`];
    }
    case 'woodStaffSlam': {
      return ['Area hit around you', 'Physical damage', `Cooldown: ${formatSeconds(WORLD_GAMEPLAY_PROFILE.woodStaffSlamCooldownMs)}`];
    }
    case 'woodStaffChainStrike': {
      const bonuses = getItemProgressionBonuses(weaponItemId, itemProgression);
      const chainStrikeCooldownMs = SKILL_REGISTRY.woodStaffChainStrike.baseCooldownMs;
      const lines = [
        `Teleports behind targets for ${WOOD_STAFF_CHAIN_STRIKE_BASE_HIT_COUNT + bonuses.woodStaffChainStrikeBonusHits} hits`,
        `Start range: ${formatTilesFromPixels(WORLD_GAMEPLAY_PROFILE.meleeStrikeRange + bonuses.meleeStrikeRangeBonusPx + bonuses.woodStaffChainStrikeRangeBonusPx)}`,
        `Search radius: ${formatTilesFromPixels(WOOD_STAFF_CHAIN_STRIKE_BASE_BOUNCE_RADIUS_PX + bonuses.woodStaffChainStrikeBounceRadiusBonusPx)}`,
        `Cooldown: ${formatSeconds(chainStrikeCooldownMs)}`,
      ];
      if (bonuses.woodStaffChainStrikeRefundChance > 0) {
        lines.push(`${Math.round(bonuses.woodStaffChainStrikeRefundChance * 100)}% chance a chained hit keeps its bounce`);
      }
      return lines;
    }
    default:
      return SKILL_TOOLTIP_STATS[skillId];
  }
}

export function getSkillDisplayName(skillId: SkillId) {
  switch (skillId) {
    case 'woodStaffStrike':
      return 'Wood Staff Strike';
    case 'woodStaffDash':
      return 'Wood Staff Dash';
    case 'woodStaffSlam':
      return 'Wood Staff Slam';
    case 'fireball':
      return 'Fireball';
    case 'fireNova':
      return 'Fire Nova';
    case 'fireField':
      return 'Fire Field';
    default:
      return skillId;
  }
}

export function getItemContextPrimaryActionLabel(itemValue: string) {
  const itemId = getInventoryItemId(itemValue);
  if (!itemId) {
    return 'Equip';
  }

  const itemType = EQUIPMENT_ITEMS[itemId].type;
  if (itemType === 'consumable') {
    return 'Use';
  }

  if (itemType === 'equipment' || itemType === 'gem') {
    return 'Equip';
  }

  return 'Store';
}
