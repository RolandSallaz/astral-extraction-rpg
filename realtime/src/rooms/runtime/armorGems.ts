export type ArmorGemCarrier = {
  headGemItem1?: string;
  headGemItem2?: string;
  headGemItem3?: string;
  bodyGemItem1?: string;
  bodyGemItem2?: string;
  bodyGemItem3?: string;
};

export type ArmorGemConfig = {
  damageTakenMultiplier: number;
  castTimeMultiplier: number;
  healingReceivedMultiplier: number;
};

export function countArmorGems(_player: ArmorGemCarrier | undefined, _gemItemId: string) {
  return 0;
}

export function getArmorGemConfig(_player: ArmorGemCarrier | undefined): ArmorGemConfig {
  return {
    damageTakenMultiplier: 1,
    castTimeMultiplier: 1,
    healingReceivedMultiplier: 1,
  };
}
