export type ArmorGemCarrier = {
  headGemItem1?: string;
  headGemItem2?: string;
  headGemItem3?: string;
  bodyGemItem1?: string;
  bodyGemItem2?: string;
  bodyGemItem3?: string;
};

export const GUARD_GEM_ID = "guard_gem";
export const FOCUS_GEM_ID = "focus_gem";
export const VITALITY_GEM_ID = "vitality_gem";

export type ArmorGemConfig = {
  damageTakenMultiplier: number;
  castTimeMultiplier: number;
  healingReceivedMultiplier: number;
};

export function countArmorGems(player: ArmorGemCarrier | undefined, gemItemId: string) {
  let count = 0;

  if (player?.headGemItem1 === gemItemId) {
    count += 1;
  }
  if (player?.headGemItem2 === gemItemId) {
    count += 1;
  }
  if (player?.headGemItem3 === gemItemId) {
    count += 1;
  }
  if (player?.bodyGemItem1 === gemItemId) {
    count += 1;
  }
  if (player?.bodyGemItem2 === gemItemId) {
    count += 1;
  }
  if (player?.bodyGemItem3 === gemItemId) {
    count += 1;
  }

  return count;
}

export function getArmorGemConfig(player: ArmorGemCarrier | undefined): ArmorGemConfig {
  const guardCount = countArmorGems(player, GUARD_GEM_ID);
  const focusCount = countArmorGems(player, FOCUS_GEM_ID);
  const vitalityCount = countArmorGems(player, VITALITY_GEM_ID);

  return {
    damageTakenMultiplier: Math.pow(0.92, guardCount),
    castTimeMultiplier: Math.pow(0.9, focusCount),
    healingReceivedMultiplier: 1 + vitalityCount * 0.25,
  };
}
