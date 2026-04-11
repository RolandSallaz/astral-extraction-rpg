import { createSeededRandom } from "./seededRandom";

export type GeneratedRaidLayout = {
  width: number;
  height: number;
  tiles: string[];
  rooms: Array<{ x: number; y: number; width: number; height: number }>;
  spawnPoints: Array<{ x: number; y: number }>;
  chests: Array<{ x: number; y: number }>;
  questObjectives: Array<{ x: number; y: number; kind: "sealed_relic_reliquary" }>;
  exitPoints: Array<{ x: number; y: number }>;
};

type RoomRect = GeneratedRaidLayout["rooms"][number];

export const CRYPT_SMALL_WIDTH = 32;
export const CRYPT_SMALL_HEIGHT = 16;

const CRYPT_SMALL_ROOMS: RoomRect[] = [
  { x: 2, y: 4, width: 6, height: 7 },
  { x: 10, y: 4, width: 6, height: 7 },
  { x: 18, y: 4, width: 6, height: 7 },
  { x: 25, y: 3, width: 5, height: 9 },
];

const CRYPT_SMALL_SPAWN_POINT = { x: 5, y: 7 };
const CRYPT_SMALL_CHEST_POINT = { x: 13, y: 7 };
const CRYPT_SMALL_TUTORIAL_RAT_POINT = { x: 21, y: 7 };
const CRYPT_SMALL_EXIT_POINT = { x: 27, y: 7 };

function getRoomCenter(room: RoomRect) {
  return {
    x: room.x + Math.floor(room.width / 2),
    y: room.y + Math.floor(room.height / 2),
  };
}

function carveCorridor(
  setTile: (x: number, y: number, tile: string) => void,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const horizontalFirst = Math.abs(from.x - to.x) >= Math.abs(from.y - to.y);

  const carveLine = (startX: number, startY: number, endX: number, endY: number) => {
    const stepX = Math.sign(endX - startX);
    const stepY = Math.sign(endY - startY);
    let x = startX;
    let y = startY;

    while (x !== endX || y !== endY) {
      setTile(x, y, "corridorFloor");
      if (x !== endX) {
        x += stepX;
      }
      if (y !== endY) {
        y += stepY;
      }
    }

    setTile(endX, endY, "corridorFloor");
  };

  if (horizontalFirst) {
    carveLine(from.x, from.y, to.x, from.y);
    carveLine(to.x, from.y, to.x, to.y);
    return;
  }

  carveLine(from.x, from.y, from.x, to.y);
  carveLine(from.x, to.y, to.x, to.y);
}

export function generateRaidLayout(seed: string, width = 128, height = 128): GeneratedRaidLayout {
  const random = createSeededRandom(seed);
  const tiles = new Array<string>(width * height).fill("wall");
  const rooms: GeneratedRaidLayout["rooms"] = [];

  const setTile = (x: number, y: number, tile: string) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    tiles[y * width + x] = tile;
  };

  const roomCount = Math.max(12, Math.floor((width * height) / 180) + Math.floor(random() * 4));
  let attempts = 0;

  while (rooms.length < roomCount && attempts < roomCount * 10) {
    attempts += 1;
    const isHall = rooms.length < 2 || random() < 0.28;
    const roomWidth = isHall ? 10 + Math.floor(random() * 6) : 5 + Math.floor(random() * 5);
    const roomHeight = isHall ? 8 + Math.floor(random() * 5) : 5 + Math.floor(random() * 4);
    const roomX = 1 + Math.floor(random() * Math.max(1, width - roomWidth - 2));
    const roomY = 1 + Math.floor(random() * Math.max(1, height - roomHeight - 2));

    const room = {
      x: roomX,
      y: roomY,
      width: roomWidth,
      height: roomHeight,
    };

    const overlapsExisting = rooms.some((existingRoom) => {
      const paddedLeft = existingRoom.x - 1;
      const paddedRight = existingRoom.x + existingRoom.width + 1;
      const paddedTop = existingRoom.y - 1;
      const paddedBottom = existingRoom.y + existingRoom.height + 1;

      return (
        room.x < paddedRight &&
        room.x + room.width > paddedLeft &&
        room.y < paddedBottom &&
        room.y + room.height > paddedTop
      );
    });

    if (overlapsExisting) {
      continue;
    }

    rooms.push(room);

    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        setTile(x, y, "roomFloor");
      }
    }

    if (rooms.length <= 1) {
      continue;
    }

    const currentCenter = getRoomCenter(room);
    const nearestExistingRoom = rooms
      .slice(0, -1)
      .map((existingRoom) => ({
        center: getRoomCenter(existingRoom),
        distance: Math.hypot(
          getRoomCenter(existingRoom).x - currentCenter.x,
          getRoomCenter(existingRoom).y - currentCenter.y,
        ),
      }))
      .sort((left, right) => left.distance - right.distance)[0];

    if (nearestExistingRoom) {
      carveCorridor(setTile, nearestExistingRoom.center, currentCenter);
    }
  }

  rooms.forEach((room, index) => {
    if (index < 2 || random() > 0.22) {
      return;
    }

    const center = getRoomCenter(room);
    const neighbor = rooms
      .filter((_, roomIndex) => roomIndex !== index)
      .map((otherRoom) => {
        const otherCenter = getRoomCenter(otherRoom);
        return {
          center: otherCenter,
          distance: Math.hypot(otherCenter.x - center.x, otherCenter.y - center.y),
        };
      })
      .filter((candidate) => candidate.distance <= 14)
      .sort((left, right) => left.distance - right.distance)[0];

    if (neighbor) {
      carveCorridor(setTile, center, neighbor.center);
    }
  });

  const roomCenters = rooms.map((room) => getRoomCenter(room));
  const spawnPoints = roomCenters.slice(0, 4);

  for (let index = 0; index < tiles.length; index += 1) {
    if (tiles[index] !== "roomFloor" && tiles[index] !== "corridorFloor") {
      continue;
    }

    if (random() < 0.12) {
      tiles[index] = tiles[index] === "roomFloor" ? "roomCracked" : "corridorCracked";
    }
  }

  for (const spawn of spawnPoints) {
    setTile(spawn.x, spawn.y, "spawnFloor");
  }

  const anchorSpawn = spawnPoints[0] ?? { x: 2, y: 2 };
  const exitPoints = roomCenters
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.hypot(left.x - anchorSpawn.x, left.y - anchorSpawn.y);
      const rightDistance = Math.hypot(right.x - anchorSpawn.x, right.y - anchorSpawn.y);
      return rightDistance - leftDistance;
    })
    .slice(0, Math.min(2, roomCenters.length))
    .filter((point, index, points) => points.findIndex((other) => other.x === point.x && other.y === point.y) === index);

  for (const exitPoint of exitPoints) {
    setTile(exitPoint.x, exitPoint.y, "exitFloor");
  }

  const reservedPoints = new Set(
    [...spawnPoints, ...exitPoints].map((point) => `${point.x}:${point.y}`),
  );
  const chestCandidates = rooms.slice(1).filter((room, index) => {
    const centerX = room.x + Math.floor(room.width / 2);
    const centerY = room.y + Math.floor(room.height / 2);

    if (reservedPoints.has(`${centerX}:${centerY}`)) {
      return false;
    }

    return room.width >= 8 || room.height >= 8 || index % 2 === 0 || random() > 0.4;
  });
  const mapCenterX = (width - 1) / 2;
  const mapCenterY = (height - 1) / 2;
  const chestCount = Math.max(2, Math.min(5, Math.floor(chestCandidates.length * 0.4)));
  const chests = chestCandidates
    .map((room) => ({
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
      score:
        Math.hypot(
          room.x + Math.floor(room.width / 2) - mapCenterX,
          room.y + Math.floor(room.height / 2) - mapCenterY,
        ) + random() * 1.5,
    }))
    .sort((left, right) => left.score - right.score)
    .slice(0, chestCount)
    .map(({ x, y }) => ({ x, y }));

  const isWalkable = (x: number, y: number) => {
    const tile = tiles[y * width + x];
    return tile !== "wall" && tile !== "wallEdge";
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (tiles[index] !== "wall") {
        continue;
      }

      const touchesFloor =
        (x > 0 && isWalkable(x - 1, y)) ||
        (x < width - 1 && isWalkable(x + 1, y)) ||
        (y > 0 && isWalkable(x, y - 1)) ||
        (y < height - 1 && isWalkable(x, y + 1));

      if (touchesFloor) {
        tiles[index] = "wallEdge";
      }
    }
  }

  return {
    width,
    height,
    tiles,
    rooms,
    spawnPoints,
    chests,
    questObjectives: [],
    exitPoints,
  };
}

function generateCryptSmallLayout(): GeneratedRaidLayout {
  const width = CRYPT_SMALL_WIDTH;
  const height = CRYPT_SMALL_HEIGHT;
  const tiles = new Array<string>(width * height).fill("wall");

  const setTile = (x: number, y: number, tile: string) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    tiles[y * width + x] = tile;
  };

  for (const room of CRYPT_SMALL_ROOMS) {
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        setTile(x, y, "roomFloor");
      }
    }
  }

  carveCorridor(setTile, CRYPT_SMALL_SPAWN_POINT, CRYPT_SMALL_CHEST_POINT);
  carveCorridor(setTile, CRYPT_SMALL_CHEST_POINT, CRYPT_SMALL_TUTORIAL_RAT_POINT);
  carveCorridor(setTile, CRYPT_SMALL_TUTORIAL_RAT_POINT, CRYPT_SMALL_EXIT_POINT);

  setTile(CRYPT_SMALL_SPAWN_POINT.x, CRYPT_SMALL_SPAWN_POINT.y, "spawnFloor");
  setTile(CRYPT_SMALL_EXIT_POINT.x, CRYPT_SMALL_EXIT_POINT.y, "exitFloor");

  for (let x = 10; x <= 23; x += 1) {
    if (tiles[7 * width + x] === "roomFloor" && x % 3 === 1) {
      setTile(x, 7, "corridorCracked");
    }
  }

  const isWalkable = (x: number, y: number) => {
    const tile = tiles[y * width + x];
    return tile !== "wall" && tile !== "wallEdge";
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (tiles[index] !== "wall") {
        continue;
      }

      const touchesFloor =
        (x > 0 && isWalkable(x - 1, y)) ||
        (x < width - 1 && isWalkable(x + 1, y)) ||
        (y > 0 && isWalkable(x, y - 1)) ||
        (y < height - 1 && isWalkable(x, y + 1));

      if (touchesFloor) {
        tiles[index] = "wallEdge";
      }
    }
  }

  return {
    width,
    height,
    tiles,
    rooms: [...CRYPT_SMALL_ROOMS],
    spawnPoints: [{ ...CRYPT_SMALL_SPAWN_POINT }],
    chests: [{ ...CRYPT_SMALL_CHEST_POINT }],
    questObjectives: [],
    exitPoints: [{ ...CRYPT_SMALL_EXIT_POINT }],
  };
}

export function generateRaidLayoutForTemplate(
  templateCode: string,
  seed: string,
  width = 128,
  height = 128,
): GeneratedRaidLayout {
  if (templateCode === "crypt_small") {
    return generateCryptSmallLayout();
  }

  const layout = generateRaidLayout(seed, width, height);

  if (templateCode !== "crypt") {
    return layout;
  }

  const anchorSpawn = layout.spawnPoints[0] ?? { x: 0, y: 0 };
  const reservedPoints = new Set(
    [...layout.spawnPoints, ...layout.exitPoints].map((point) => `${point.x}:${point.y}`),
  );
  const questRoomCenter = layout.rooms
    .map((room) => ({
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
      score:
        Math.hypot(room.x + Math.floor(room.width / 2) - anchorSpawn.x, room.y + Math.floor(room.height / 2) - anchorSpawn.y) +
        Math.max(room.width, room.height) * 0.35,
    }))
    .filter((room) => !reservedPoints.has(`${room.x}:${room.y}`))
    .sort((left, right) => right.score - left.score)[0];

  if (!questRoomCenter) {
    return layout;
  }

  return {
    ...layout,
    chests: layout.chests.filter((chest) => chest.x !== questRoomCenter.x || chest.y !== questRoomCenter.y),
    questObjectives: [
      {
        x: questRoomCenter.x,
        y: questRoomCenter.y,
        kind: "sealed_relic_reliquary",
      },
    ],
  };
}
