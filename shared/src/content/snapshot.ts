import type { ItemBalanceConfig } from "../balance/itemBalance";
import type { MobBalanceConfig } from "../balance/mobBalance";
import type { SkillBalanceConfig } from "../balance/skillBalance";
import type { MobVisualConfig } from "../mobs/visuals";

export type GameContentSnapshotVersion = {
  version: string;
};

export type GameContentSnapshot = GameContentSnapshotVersion & {
  skillBalance: SkillBalanceConfig;
  mobBalance: MobBalanceConfig;
  itemBalance: ItemBalanceConfig;
  mobVisuals: MobVisualConfig;
};
