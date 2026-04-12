export type PlayerAnimationState = "idle" | "move" | "cast" | "death";
export type PlayerBodyPart = "body" | "head";
export type PlayerEyeLookDirection = "up" | "down";

export type PlayerEyePixelPosition = {
  x: number;
  y: number;
};

export type PlayerEyePairPosition = {
  left: PlayerEyePixelPosition;
  right: PlayerEyePixelPosition;
};

export type PlayerPartVisualDefinition = {
  key: string;
  texturePath: string;
  frameWidth?: number;
  frameHeight?: number;
  defaultFrame?: number;
  displayScale: number;
  anchorY: number;
  offsetX: number;
  offsetY: number;
};

export type PlayerAnimationClipDefinition = {
  textureKey: string;
  texturePath: string;
  frameWidth: number;
  frameHeight: number;
  startFrame: number;
  frameCount: number;
  frameMs: number;
  loop: boolean;
  headOffsetYFrames?: number[];
};

export type PlayerVisualDefinition = Record<PlayerBodyPart, PlayerPartVisualDefinition> & {
  animations: Partial<Record<PlayerAnimationState, PlayerAnimationClipDefinition>>;
  eyes: {
    color: string;
    positions: Record<PlayerEyeLookDirection, PlayerEyePairPosition>;
  };
};

export const DEFAULT_PLAYER_VISUALS: PlayerVisualDefinition = {
  body: {
    key: "player-body-base",
    texturePath: "/character/character_idle_body.png",
    frameWidth: 16,
    frameHeight: 16,
    defaultFrame: 0,
    displayScale: 1,
    anchorY: 0.5,
    offsetX: 0,
    offsetY: 0,
  },
  head: {
    key: "player-head-base",
    texturePath: "/character/character_head.png",
    frameWidth: 16,
    frameHeight: 16,
    defaultFrame: 0,
    displayScale: 1,
    anchorY: 0.5,
    offsetX: 0,
    offsetY: 0,
  },
  animations: {
    idle: {
      textureKey: "player-body-idle",
      texturePath: "/character/character_idle_body.png",
      frameWidth: 16,
      frameHeight: 16,
      startFrame: 0,
      frameCount: 4,
      frameMs: 220,
      loop: true,
      headOffsetYFrames: [-1, 0, 1, 0],
    },
    move: {
      textureKey: "player-body-run",
      texturePath: "/character/character_run_body.png",
      frameWidth: 16,
      frameHeight: 16,
      startFrame: 0,
      frameCount: 4,
      frameMs: 110,
      loop: true,
      headOffsetYFrames: [0, -1, 0, 1],
    },
  },
  eyes: {
    color: "#24150e",
    positions: {
      up: {
        left: { x: 8, y: 4 },
        right: { x: 11, y: 4 },
      },
      down: {
        left: { x: 8, y: 5 },
        right: { x: 11, y: 5 },
      },
    },
  },
};
