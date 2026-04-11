import type { MobBalanceConfig } from '@mmorpg/shared/balance/mobBalance';

export class UpdateMobBalanceDto implements Partial<Record<keyof MobBalanceConfig, Partial<MobBalanceConfig[keyof MobBalanceConfig]>>> {
  [key: string]: Partial<MobBalanceConfig[keyof MobBalanceConfig]> | undefined;
}
