import { Schema, type } from "@colyseus/schema";

/**
 * Client-synced projectile state — only visual/positional fields.
 * Combat-logic fields live in ProjectileServerData (never sent to clients).
 */
export class ProjectileState extends Schema {
  @type("string") id = "";
  @type("string") ownerId = "";
  @type("string") skillId = "fireball";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") directionX = 0;
  @type("number") directionY = 0;
  @type("number") lifetime = 0;
  @type("number") originX = 0;
  @type("number") originY = 0;
  @type("boolean") returning = false;
  @type("number") bouncesRemaining = 0;
  @type("number") sizeScale = 1;
  @type("number") speed = 0;
  @type("number") spiralAmplitude = 0;
  @type("number") spiralFrequency = 0;
  @type("number") spiralPhase = 0;
}

/**
 * Server-only projectile combat data — never serialized to clients.
 * Stored in a parallel Map<string, ProjectileServerData> on the room.
 */
export type ProjectileServerData = {
  piercesRemaining: number;
  chainRemaining: number;
  damageScale: number;
  maxDistance: number;
  homingStrength: number;
  splashRadius: number;
  splashDamageScale: number;
  knockbackDistance: number;
  lifestealRatio: number;
  executionThreshold: number;
  executionDamageMultiplier: number;
  criticalChance: number;
  criticalDamageMultiplier: number;
  selfHitGraceEndsAt: number;
  fork: boolean;
  forkDamageScale: number;
  distanceTraveled: number;
  orbitTimeRemaining: number;
  orbitRadius: number;
  aftershockDelayMs: number;
  aftershockDamageScale: number;
  novaImpactCount: number;
  novaImpactDamageScale: number;
  cloneOnHit: boolean;
  cloneDamageScale: number;
};

export function createDefaultProjectileServerData(): ProjectileServerData {
  return {
    piercesRemaining: 0,
    chainRemaining: 0,
    damageScale: 1,
    maxDistance: 0,
    homingStrength: 0,
    splashRadius: 0,
    splashDamageScale: 0,
    knockbackDistance: 0,
    lifestealRatio: 0,
    executionThreshold: 0,
    executionDamageMultiplier: 1,
    criticalChance: 0,
    criticalDamageMultiplier: 1,
    selfHitGraceEndsAt: 0,
    fork: false,
    forkDamageScale: 1,
    distanceTraveled: 0,
    orbitTimeRemaining: 0,
    orbitRadius: 0,
    aftershockDelayMs: 0,
    aftershockDamageScale: 0,
    novaImpactCount: 0,
    novaImpactDamageScale: 0,
    cloneOnHit: false,
    cloneDamageScale: 0,
  };
}
