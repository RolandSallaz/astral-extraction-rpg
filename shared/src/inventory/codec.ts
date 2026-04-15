import {
  canonicalizeItemId,
  EMPTY_ITEM_SLOT,
  type GemItemId,
  type ItemId,
  ITEM_DEFINITIONS,
  isGemItemId,
  isItemId,
} from "../items/catalog";

export const STACK_SEPARATOR = "::";
export const METADATA_SEPARATOR = "##";
export const SOCKET_SEPARATOR = "@@";
export const RAID_UNIDENTIFIED_METADATA_FLAG = "raid_unidentified";

export type ParsedInventoryItem = {
  itemId: ItemId;
  code: ItemId;
  quantity: number;
  isStacked: boolean;
  raidUnidentified: boolean;
  socketedGemIds: Array<GemItemId | null>;
  socketedGemCodes: GemItemId[];
};

export function normalizeSocketedGemIds(
  itemId: ItemId,
  socketedGemIds?: Array<string | null> | null,
): Array<GemItemId | null> {
  const socketCount = ITEM_DEFINITIONS[itemId].socketCount ?? 0;
  const nextSocketedGemIds = Array.from({ length: socketCount }, (_, index) => {
    const candidate = socketedGemIds?.[index] ?? null;
    return candidate && isGemItemId(candidate) ? candidate : null;
  });

  while (nextSocketedGemIds.length > 0 && nextSocketedGemIds[nextSocketedGemIds.length - 1] === null) {
    nextSocketedGemIds.pop();
  }

  return nextSocketedGemIds;
}

export function serializeInventoryItem(
  itemId: ItemId,
  quantity = 1,
  socketedGemIds?: Array<string | null> | null,
  options?: { raidUnidentified?: boolean },
) {
  const item = ITEM_DEFINITIONS[itemId];
  const normalizedSocketedGemIds = normalizeSocketedGemIds(itemId, socketedGemIds);
  const metadataSuffix = options?.raidUnidentified ? `${METADATA_SEPARATOR}${RAID_UNIDENTIFIED_METADATA_FLAG}` : "";

  if (!item.stackable || quantity <= 1) {
    if (normalizedSocketedGemIds.length === 0) {
      return `${itemId}${metadataSuffix}`;
    }

    return `${itemId}${metadataSuffix}${SOCKET_SEPARATOR}${normalizedSocketedGemIds.map((gemId) => gemId ?? "").join(",")}`;
  }

  return `${itemId}${STACK_SEPARATOR}${Math.max(1, Math.min(item.maxStack ?? quantity, quantity))}${metadataSuffix}`;
}

export function serializeRaidUnidentifiedInventoryItem(
  itemId: ItemId,
  quantity = 1,
  socketedGemIds?: Array<string | null> | null,
) {
  return serializeInventoryItem(itemId, quantity, socketedGemIds, { raidUnidentified: true });
}

export function parseInventoryItem(value: string | null | undefined): ParsedInventoryItem | null {
  if (!value) {
    return null;
  }

  const [rawBasePart, rawSocketPart] = value.split(SOCKET_SEPARATOR, 2);
  const [rawBaseWithQuantity, rawMetadataPart] = rawBasePart.split(METADATA_SEPARATOR, 2);
  const [rawBaseId, rawQuantity] = rawBaseWithQuantity.split(STACK_SEPARATOR);
  const baseId = canonicalizeItemId(rawBaseId);
  if (!baseId || !isItemId(baseId)) {
    return null;
  }

  const item = ITEM_DEFINITIONS[baseId];
  const metadataFlags = (rawMetadataPart ?? "")
    .split(",")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
  const parsedQuantity = Number.parseInt(rawQuantity ?? "1", 10);
  const quantity = item.stackable
    ? Math.max(1, Math.min(item.maxStack ?? 1, Number.isFinite(parsedQuantity) ? parsedQuantity : 1))
    : 1;
  const socketedGemIds =
    item.socketCount && item.socketCount > 0
      ? normalizeSocketedGemIds(
          baseId,
          (rawSocketPart ?? "")
            .split(",")
            .map((candidate) => candidate.trim() || null),
        )
      : [];

  return {
    itemId: baseId,
    code: baseId,
    quantity,
    isStacked: item.stackable === true,
    raidUnidentified: metadataFlags.includes(RAID_UNIDENTIFIED_METADATA_FLAG),
    socketedGemIds,
    socketedGemCodes: socketedGemIds.filter((gemId): gemId is GemItemId => gemId !== null),
  };
}

export function getInventoryItemId(value: string | null | undefined) {
  return parseInventoryItem(value)?.itemId ?? null;
}

export function getInventoryItemQuantity(value: string | null | undefined) {
  return parseInventoryItem(value)?.quantity ?? 0;
}

export function normalizeInventoryEntry(value: string | null | undefined) {
  const parsed = parseInventoryItem(value);
  if (!parsed) {
    return EMPTY_ITEM_SLOT;
  }

  return serializeInventoryItem(parsed.itemId, parsed.quantity, parsed.socketedGemIds, {
    raidUnidentified: parsed.raidUnidentified,
  });
}

export function identifyInventoryEntry(value: string | null | undefined) {
  const parsed = parseInventoryItem(value);
  if (!parsed) {
    return EMPTY_ITEM_SLOT;
  }

  return serializeInventoryItem(parsed.itemId, parsed.quantity, parsed.socketedGemIds);
}

export function revealMatchedRaidUnidentifiedInventoryEntries(
  values: Array<string | null | undefined>,
) {
  const identifiedQuantities = new Map<ItemId, number>();
  const unidentifiedQuantities = new Map<ItemId, number>();

  values.forEach((value) => {
    const parsed = parseInventoryItem(value);
    if (!parsed) {
      return;
    }

    const targetMap = parsed.raidUnidentified ? unidentifiedQuantities : identifiedQuantities;
    targetMap.set(parsed.itemId, (targetMap.get(parsed.itemId) ?? 0) + parsed.quantity);
  });

  return values.map((value) => {
    const parsed = parseInventoryItem(value);
    if (!parsed || !parsed.raidUnidentified) {
      return normalizeInventoryEntry(value);
    }

    const knownQuantity = identifiedQuantities.get(parsed.itemId) ?? 0;
    const matchingUnknownQuantity = unidentifiedQuantities.get(parsed.itemId) ?? 0;
    if (knownQuantity > 0 || matchingUnknownQuantity >= 2) {
      return identifyInventoryEntry(value);
    }

    return normalizeInventoryEntry(value);
  });
}

export function identifyAllRaidUnidentifiedInventoryEntries(
  values: Array<string | null | undefined>,
) {
  return values.map((value) => identifyInventoryEntry(value));
}
