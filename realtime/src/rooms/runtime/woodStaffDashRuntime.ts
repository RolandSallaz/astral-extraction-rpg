import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import { getSegmentEllipseCollisionT } from "./geometry.js";
import { setMobAggroTarget } from "./mobAi.js";
import type { DamageType } from "./projectileSkills.js";

type WoodStaffDashTarget =
  | { kind: "player"; entity: BasePlayerState; t: number }
  | { kind: "mob"; entity: MobState; t: number };

export interface WoodStaffDashContext {
  profile: RoomGameplayProfile;
  roomPlayers: MapSchema<BasePlayerState>;
  queryNearbyMobs(x: number, y: number, radius: number): Iterable<MobState>;
  canTeleportTo(x: number, y: number, playerId: string): boolean;
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  handlePlayerKilled(player: BasePlayerState): void;
  handleMobDeath(mob: MobState): void;
  awardExperience(playerId: string, amount: number): void;
  broadcastDamageText(x: number, y: number, text: string, color?: string): void;
  onCombatLog(text: string): void;
}

export function performWoodStaffDash(
  ctx: WoodStaffDashContext,
  ownerId: string,
  player: BasePlayerState,
  targetX: number,
  targetY: number,
): void {
  const p = ctx.profile;
  const deltaX = targetX - player.x;
  const deltaY = targetY - player.y;
  const length = Math.hypot(deltaX, deltaY);
  const directionX = length > 0.001 ? deltaX / length : 1;
  const directionY = length > 0.001 ? deltaY / length : 0;
  const maxDistance = p.tileSize * p.woodStaffDashDistanceTiles;
  const stepDistance = Math.max(4, p.tileSize / 4);
  const steps = Math.max(1, Math.ceil(maxDistance / stepDistance));
  let destinationX = player.x;
  let destinationY = player.y;

  for (let step = 1; step <= steps; step += 1) {
    const travelled = Math.min(maxDistance, step * stepDistance);
    const candidateX = player.x + directionX * travelled;
    const candidateY = player.y + directionY * travelled;
    if (!ctx.canTeleportTo(candidateX, candidateY, player.id)) {
      break;
    }
    destinationX = candidateX;
    destinationY = candidateY;
  }

  const target = findFirstDashTarget(ctx, player, destinationX, destinationY);
  if (target) {
    const collisionX = player.x + (destinationX - player.x) * target.t;
    const collisionY = player.y + (destinationY - player.y) * target.t;
    destinationX = collisionX;
    destinationY = collisionY;
    applyWoodStaffDashDamage(ctx, ownerId, player, target);
  }

  player.x = destinationX;
  player.y = destinationY;
}

function findFirstDashTarget(
  ctx: WoodStaffDashContext,
  player: BasePlayerState,
  destinationX: number,
  destinationY: number,
): WoodStaffDashTarget | null {
  const p = ctx.profile;
  const distance = Math.hypot(destinationX - player.x, destinationY - player.y);
  const midX = (player.x + destinationX) / 2;
  const midY = (player.y + destinationY) / 2;
  const queryRadius = distance / 2 + Math.max(p.mobHitRadius, p.playerHitRadius) + 8;
  let firstTarget: WoodStaffDashTarget | null = null;

  for (const mob of ctx.queryNearbyMobs(midX, midY, queryRadius)) {
    if (mob.dead) {
      continue;
    }
    const collisionT = getSegmentEllipseCollisionT(
      player.x,
      player.y,
      destinationX,
      destinationY,
      mob.x,
      mob.y + p.meleeStrikeMobCenterOffsetY,
      p.mobHitRadius,
      p.mobHitRadius,
    );
    if (collisionT === null) {
      continue;
    }
    if (!firstTarget || collisionT < firstTarget.t) {
      firstTarget = { kind: "mob", entity: mob, t: collisionT };
    }
  }

  for (const candidate of ctx.roomPlayers.values()) {
    if (candidate.id === player.id || candidate.dead) {
      continue;
    }
    const collisionT = getSegmentEllipseCollisionT(
      player.x,
      player.y,
      destinationX,
      destinationY,
      candidate.x,
      candidate.y,
      p.playerHitRadius,
      p.playerHitRadius,
    );
    if (collisionT === null) {
      continue;
    }
    if (!firstTarget || collisionT < firstTarget.t) {
      firstTarget = { kind: "player", entity: candidate, t: collisionT };
    }
  }

  return firstTarget;
}

function applyWoodStaffDashDamage(
  ctx: WoodStaffDashContext,
  ownerId: string,
  player: BasePlayerState,
  target: WoodStaffDashTarget,
): void {
  const baseDamage = Math.max(1, ctx.profile.woodStaffDashDamage);
  const strengthBonus = Math.max(0, player.strength - 1) * 2;
  const damage = baseDamage + strengthBonus;

  if (target.kind === "player") {
    const resolvedDamage = ctx.applyDamageToPlayer(target.entity, damage, "physical");
    ctx.onCombatLog(`${player.name} dashes into ${target.entity.name} for ${resolvedDamage}.`);
    if (resolvedDamage > 0) {
      ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${resolvedDamage}`, "#ffd089");
    }
    if (target.entity.health <= 0) {
      ctx.handlePlayerKilled(target.entity);
    }
    return;
  }

  target.entity.health = Math.max(0, target.entity.health - damage);
  setMobAggroTarget(target.entity, player);
  ctx.onCombatLog(`${player.name} dashes into ${target.entity.name} for ${damage}.`);
  if (damage > 0) {
    ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${damage}`, "#ffd089");
  }
  if (target.entity.health <= 0) {
    ctx.handleMobDeath(target.entity);
    ctx.awardExperience(ownerId, target.entity.experienceReward);
  }
}
