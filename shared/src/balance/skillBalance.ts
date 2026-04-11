export type SkillBalanceConfig = {
  fireball: {
    damage: number;
    burnDamage: number;
    burnTicks: number;
  };
  fireNova: {
    damage: number;
    burnDamage: number;
    burnTicks: number;
  };
  fireField: {
    damage: number;
    burnDamage: number;
    burnTicks: number;
  };
};

export const DEFAULT_SKILL_BALANCE_CONFIG: SkillBalanceConfig = {
  fireball: {
    damage: 20,
    burnDamage: 1,
    burnTicks: 5,
  },
  fireNova: {
    damage: 20,
    burnDamage: 1,
    burnTicks: 5,
  },
  fireField: {
    damage: 4,
    burnDamage: 1,
    burnTicks: 5,
  },
};

export function cloneSkillBalanceConfig(config: SkillBalanceConfig): SkillBalanceConfig {
  return {
    fireball: { ...config.fireball },
    fireNova: { ...config.fireNova },
    fireField: { ...config.fireField },
  };
}
