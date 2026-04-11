import type { CharacterProfile } from '@/lib/playerProfile';
import type { ItemBalanceConfig } from '@/lib/itemBalance';
import type { SkillBalanceConfig } from '@/lib/skillBalance';
import type { MobBalanceConfig } from '@/lib/mobBalance';

export type PartyView = {
  id: string;
  code: string;
  status: string;
  pendingRaid: {
    raidRunId: string;
    startedAt: string | null;
    realtimeRoom: {
      roomName: string;
      options: Record<string, string | number>;
    };
  } | null;
  members: Array<{
    playerId: string;
    nickname: string;
    isLeader: boolean;
    isReady: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type RaidTemplateView = {
  id: string;
  code: string;
  name: string;
  description: string;
  biome: string;
  minPlayers: number;
  maxPlayers: number;
  width: number;
  height: number;
  isActive: boolean;
};

export type StartedRaidView = {
  id: string;
  seed: string;
  status: string;
  playerCount: number;
  joinedExisting: boolean;
  template: RaidTemplateView;
  partyId: string | null;
  generatedLayout: {
    width: number;
    height: number;
    rooms: Array<{ x: number; y: number; width: number; height: number }>;
    spawnPoints: Array<{ x: number; y: number }>;
    chests: Array<{ x: number; y: number }>;
    exitPoints: Array<{ x: number; y: number }>;
  } | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  realtimeRoom: {
    roomName: string;
    options: Record<string, string | number>;
  };
};

const SESSION_TOKEN_KEY = 'mmorpg.session-token.v1';

type AuthResponse = {
  token: string;
  player: {
    id: string;
    nickname: string;
    role: string;
    character: CharacterProfile;
  };
};

function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  return 'http://localhost:3000';
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function setSessionToken(token: string | null) {
  if (!isBrowser()) {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

function getSessionToken() {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  if (authenticated) {
    const token = getSessionToken();
    if (!token) {
      throw new Error('Missing session token.');
    }

    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message;
    throw new Error(message || 'Request failed.');
  }

  if (response.status === 204) {
    return null as T;
  }

  const responseText = await response.text();
  if (!responseText.trim()) {
    return null as T;
  }

  return JSON.parse(responseText) as T;
}

export async function registerPlayer(input: {
  nickname: string;
  password: string;
}) {
  const response = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  setSessionToken(response.token);

  return {
    username: response.player.nickname,
    role: response.player.role,
    character: response.player.character,
  };
}

export async function loginPlayer(input: { nickname: string; password: string }) {
  const response = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  setSessionToken(response.token);

  return {
    username: response.player.nickname,
    role: response.player.role,
    character: response.player.character,
  };
}

export async function loadSessionPlayer() {
  const token = getSessionToken();
  if (!token) {
    return null;
  }

  try {
    const response = await request<{
      id: string;
      nickname: string;
      role: string;
      character: CharacterProfile;
    }>('/auth/me', undefined, true);

    return {
      username: response.nickname,
      role: response.role,
      character: response.character,
    };
  } catch {
    setSessionToken(null);
    return null;
  }
}

export async function saveCharacter(character: CharacterProfile) {
  const response = await request<{
    id: string;
    nickname: string;
    character: CharacterProfile;
  }>(
    '/players/me',
    {
      method: 'PATCH',
      body: JSON.stringify({
        equipment: character.equipment,
        inventory: character.inventory,
        gold: character.gold,
        position: character.position,
        health: character.health,
        maxHealth: character.maxHealth,
        level: character.level,
        experience: character.experience,
        strength: character.strength,
        agility: character.agility,
        intellect: character.intellect,
        quests: character.quests,
      }),
    },
    true,
  );

  return response.character;
}

export async function giveItemToPlayer(input: { nickname: string; itemCode: string }) {
  return request<{
    id: string;
    nickname: string;
    role: string;
    character: CharacterProfile;
  }>(
    '/players/admin/give-item',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    true,
  );
}

export async function loadSkillBalanceConfig() {
  return request<SkillBalanceConfig>('/game-configs/skill-balance', undefined, true);
}

export async function saveSkillBalanceConfig(config: SkillBalanceConfig) {
  return request<SkillBalanceConfig>(
    '/game-configs/skill-balance',
    {
      method: 'PATCH',
      body: JSON.stringify(config),
    },
    true,
  );
}

export async function loadMobBalanceConfig() {
  return request<MobBalanceConfig>('/game-configs/mob-balance', undefined, true);
}

export async function saveMobBalanceConfig(config: MobBalanceConfig) {
  return request<MobBalanceConfig>(
    '/game-configs/mob-balance',
    {
      method: 'PATCH',
      body: JSON.stringify(config),
    },
    true,
  );
}

export async function loadItemBalanceConfig() {
  return request<ItemBalanceConfig>('/game-configs/item-balance', undefined, true);
}

export async function saveItemBalanceConfig(config: ItemBalanceConfig) {
  return request<ItemBalanceConfig>(
    '/game-configs/item-balance',
    {
      method: 'PATCH',
      body: JSON.stringify(config),
    },
    true,
  );
}

export async function loadMyParty() {
  return request<PartyView | null>('/parties/me', undefined, true);
}

export async function createParty() {
  return request<PartyView>(
    '/parties',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    true,
  );
}

export async function joinParty(code: string) {
  return request<PartyView>(
    '/parties/join',
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    },
    true,
  );
}

export async function setPartyReady(ready: boolean) {
  return request<PartyView>(
    '/parties/ready',
    {
      method: 'POST',
      body: JSON.stringify({ ready }),
    },
    true,
  );
}

export async function leaveParty() {
  return request<PartyView | null>(
    '/parties/leave',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    true,
  );
}

export async function ackPendingRaidJoin(raidRunId?: string) {
  return request<PartyView | null>(
    '/parties/ack-raid',
    {
      method: 'POST',
      body: JSON.stringify(raidRunId ? { raidRunId } : {}),
    },
    true,
  );
}

export async function loadRaidTemplates() {
  return request<RaidTemplateView[]>('/raids/templates', undefined, true);
}

export async function startRaid(templateCode: string, partyId?: string) {
  return request<StartedRaidView>(
    '/raids/start',
    {
      method: 'POST',
      body: JSON.stringify({
        templateCode,
        partyId,
      }),
    },
    true,
  );
}

export function logoutPlayer() {
  setSessionToken(null);
}
