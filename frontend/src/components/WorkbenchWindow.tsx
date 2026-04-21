'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HudWindow } from './ui/HudWindow';
import { ItemIcon } from './ItemIcon';
import { ITEM_DEFINITIONS } from '@/lib/items/equipmentItems';
import type { ItemProgressionTier } from '@mmorpg/shared';

export type WorkbenchTab = 'craft' | 'upgrade';
export type WorkbenchUpgradeChoiceView = {
  id: string;
  level: ItemProgressionTier;
  title: string;
  description: string;
  isPlaceholder?: boolean;
  isAvailable: boolean;
  statLines: string[];
};

export type WorkbenchSelectedUpgradeView = {
  id: string;
  level: ItemProgressionTier;
  title: string;
  description: string;
  isPlaceholder?: boolean;
};

export type WorkbenchTierChoicesView = {
  tier: ItemProgressionTier;
  choices: WorkbenchUpgradeChoiceView[];
};

export type WorkbenchUpgradeableWeaponView = {
  key: string;
  sourceLabel: string;
  title: string;
  subtitle: string;
  level: number;
  selectedUpgrades: WorkbenchSelectedUpgradeView[];
  selectedUpgradeTitles: string[];
  nextChoices: WorkbenchUpgradeChoiceView[];
  allTierChoices: WorkbenchTierChoicesView[];
};

type WorkbenchWindowProps = {
  isOpen: boolean;
  tab: WorkbenchTab;
  onTabChange: (tab: WorkbenchTab) => void;
  woodCount: number;
  canCraft: boolean;
  isCrafting: boolean;
  hasPendingPickup: boolean;
  progress: number;
  status: string;
  onCraft: () => void;
  onCollect: () => void;
  upgradeableWeapons: WorkbenchUpgradeableWeaponView[];
  selectedUpgradeableWeaponKey: string | null;
  onSelectUpgradeableWeapon: (weaponKey: string) => void;
  onApplyUpgradeChoice: (choiceId: string) => void;
  onResetUpgrades: () => void;
  onClose: () => void;
};

// ─── POE-style upgrade tree ───────────────────────────────────────────────────

type NodeState = 'base' | 'selected' | 'available' | 'other-path' | 'locked';

type HoveredNode = {
  title: string;
  description: string;
  state: NodeState;
  isPlaceholder?: boolean;
  statLines?: string[];
};

function initials(title: string): string {
  return title
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const NODE_STYLE: Record<
  NodeState,
  { fill: string; stroke: string; sw: number; tc: string; glow: boolean; dash?: string }
> = {
  base:         { fill: '#2e6318', stroke: '#a8d96e', sw: 2.5, tc: '#e8ffd6', glow: true },
  selected:     { fill: '#255212', stroke: '#8ecf50', sw: 2.5, tc: '#d4edac', glow: true },
  available:    { fill: '#152b08', stroke: '#c8e870', sw: 2,   tc: '#c0df98', glow: false },
  'other-path': { fill: '#101f08', stroke: '#374e20', sw: 1.5, tc: '#4a6b30', glow: false },
  locked:       { fill: '#0b1507', stroke: '#1c2f0f', sw: 1,   tc: '#283818', glow: false, dash: '3 3' },
};

const LINE_ACTIVE   = { stroke: '#5a9035', sw: 2 };
const LINE_INACTIVE = { stroke: '#1c3010', sw: 1 };

// SVG layout constants — 25 tiers, 70px spacing
const W = 296;
const H = 1796;
const CX = W / 2;           // 148
const BASE_R = 25;
const NODE_R = 19;
const LEFT_X  = 68;
const RIGHT_X = W - 68;    // 228
const TIER_Y: Record<number, number> = {
  1: 42,
  2: 112,
  3: 182,
  4: 252,
  5: 322,
  6: 392,
  7: 462,
  8: 532,
  9: 602,
  10: 672,
  11: 742,
  12: 812,
  13: 882,
  14: 952,
  15: 1022,
  16: 1092,
  17: 1162,
  18: 1232,
  19: 1302,
  20: 1372,
  21: 1442,
  22: 1512,
  23: 1582,
  24: 1652,
  25: 1722,
};
const TIERS: ItemProgressionTier[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

// Junction (diamond) nodes sit at the midpoint between tiers.
// JY[0]  = between T1 and T2  (always active)
// JY[n]  = between T(n+1) and T(n+2), active when weapon.level >= n+1
// JY[9]–JY[12]  are SKIPPED (tiers 10–14 use column lines instead)
// JY[13]–JY[18] = tiers 14–19 neutral section junctions
// JY[19]–JY[23] are SKIPPED (tiers 20–25 use column lines instead)
const JUNCTION_R = 4;
const JY = [
  80, 147, 217, 287, 357, 427, 497, 567, 637, // 0–8: T1-T2 … T9-T10
  707, 777, 847, 917,                          // 9–12: T10-T11 … T13-T14 (column section, not rendered)
  987, 1057, 1127, 1197, 1267, 1337,           // 13–18: T14-T15 … T19-T20 (neutral section)
] as const;

function UpgradeTreeSvg({
  weapon,
  selectedUpgradeByLevel,
  onApplyUpgradeChoice,
}: {
  weapon: WorkbenchUpgradeableWeaponView;
  selectedUpgradeByLevel: Map<ItemProgressionTier, WorkbenchSelectedUpgradeView>;
  onApplyUpgradeChoice: (choiceId: string) => void;
}) {
  const [hovered, setHovered] = useState<HoveredNode | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const getNodeState = (tier: ItemProgressionTier, choiceId: string): NodeState => {
    const sel = selectedUpgradeByLevel.get(tier);
    if (sel?.id === choiceId) return 'selected';
    if (sel) return 'other-path';
    if (weapon.nextChoices.some((c) => c.id === choiceId)) return 'available';
    return 'locked';
  };

  // Build line segments with correct active state using junction topology:
  //   Base → Junction0 → [T2L, T2R]
  //   T2(selected) → Junction1 → [T3L, T3R]
  //   T3(selected) → Junction2 → [T4L, T4R]
  //   T4(selected) → Junction3 → [T5L, T5R]
  type LineData = { x1: number; y1: number; x2: number; y2: number; active: boolean };
  const lineSegments: LineData[] = [];

  // Base → Junction0 (always active)
  lineSegments.push({ x1: CX, y1: TIER_Y[1] + BASE_R, x2: CX, y2: JY[0] - JUNCTION_R, active: true });
  // Junction0 → T2L, T2R (always active — T2 is always the first available tier)
  lineSegments.push({ x1: CX, y1: JY[0] + JUNCTION_R, x2: LEFT_X,  y2: TIER_Y[2] - NODE_R, active: true });
  lineSegments.push({ x1: CX, y1: JY[0] + JUNCTION_R, x2: RIGHT_X, y2: TIER_Y[2] - NODE_R, active: true });

  // Inter-tier junctions: T2->J1->T3, ..., T9->J8->T10
  ([2, 3, 4, 5, 6, 7, 8, 9] as const).forEach((tier, i) => {
    const jIdx = i + 1;
    const jY = JY[jIdx];
    const nextTier = (tier + 1) as ItemProgressionTier;
    const tierChoices = weapon.allTierChoices.find((tc) => tc.tier === tier)?.choices ?? [];
    const selId = selectedUpgradeByLevel.get(tier)?.id;
    tierChoices.forEach((choice, idx) => {
      const choiceX = idx === 0 ? LEFT_X : RIGHT_X;
      lineSegments.push({
        x1: choiceX, y1: TIER_Y[tier] + NODE_R,
        x2: CX, y2: jY - JUNCTION_R,
        active: choice.id === selId && Boolean(selId),
      });
    });
    const jActive = weapon.level >= tier;
    const nextTierChoices = weapon.allTierChoices.find((tc) => tc.tier === nextTier)?.choices ?? [];
    nextTierChoices.forEach((_choice, idx) => {
      const choiceX = idx === 0 ? LEFT_X : RIGHT_X;
      lineSegments.push({ x1: CX, y1: jY + JUNCTION_R, x2: choiceX, y2: TIER_Y[nextTier] - NODE_R, active: jActive });
    });
  });

  // Path commitment columns: T10->T14 use direct vertical lines per column (no center junction)
  // Column 0 (LEFT_X) = chain path, Column 1 (RIGHT_X) = volley path
  const tier10Choices = weapon.allTierChoices.find((tc) => tc.tier === 10)?.choices ?? [];
  const tier10SelectedIdx = tier10Choices.findIndex((c) => c.id === selectedUpgradeByLevel.get(10)?.id);

  ([10, 11, 12, 13] as const).forEach((tier) => {
    const nextTier = (tier + 1) as ItemProgressionTier;
    const tierChoices = weapon.allTierChoices.find((tc) => tc.tier === tier)?.choices ?? [];
    tierChoices.forEach((_choice, idx) => {
      const colX = idx === 0 ? LEFT_X : RIGHT_X;
      const active = tier10SelectedIdx === idx && weapon.level >= tier;
      lineSegments.push({
        x1: colX, y1: TIER_Y[tier] + NODE_R,
        x2: colX, y2: TIER_Y[nextTier] - NODE_R,
        active,
      });
    });
  });

  // Neutral mastery section: T14->T19 converge back to center junctions (JY[13]–JY[18])
  ([14, 15, 16, 17, 18, 19] as const).forEach((tier, i) => {
    const jIdx = 13 + i;
    const jY = JY[jIdx];
    const nextTier = (tier + 1) as ItemProgressionTier;
    const tierChoices = weapon.allTierChoices.find((tc) => tc.tier === tier)?.choices ?? [];
    const selId = selectedUpgradeByLevel.get(tier)?.id;
    tierChoices.forEach((choice, idx) => {
      const choiceX = idx === 0 ? LEFT_X : RIGHT_X;
      lineSegments.push({
        x1: choiceX, y1: TIER_Y[tier] + NODE_R,
        x2: CX, y2: jY - JUNCTION_R,
        active: choice.id === selId && Boolean(selId),
      });
    });
    const jActive = weapon.level >= tier;
    const nextTierChoices = weapon.allTierChoices.find((tc) => tc.tier === nextTier)?.choices ?? [];
    nextTierChoices.forEach((_choice, idx) => {
      const choiceX = idx === 0 ? LEFT_X : RIGHT_X;
      lineSegments.push({ x1: CX, y1: jY + JUNCTION_R, x2: choiceX, y2: TIER_Y[nextTier] - NODE_R, active: jActive });
    });
  });

  // Ultimate path columns: T20->T25 use direct vertical lines per column (no center junction)
  // Column 0 (LEFT_X) = Storm Incarnate path, Column 1 (RIGHT_X) = Void Fracture path
  const tier20Choices = weapon.allTierChoices.find((tc) => tc.tier === 20)?.choices ?? [];
  const tier20SelectedIdx = tier20Choices.findIndex((c) => c.id === selectedUpgradeByLevel.get(20)?.id);

  ([20, 21, 22, 23, 24] as const).forEach((tier) => {
    const nextTier = (tier + 1) as ItemProgressionTier;
    const tierChoices = weapon.allTierChoices.find((tc) => tc.tier === tier)?.choices ?? [];
    tierChoices.forEach((_choice, idx) => {
      const colX = idx === 0 ? LEFT_X : RIGHT_X;
      const active = tier20SelectedIdx === idx && weapon.level >= tier;
      lineSegments.push({
        x1: colX, y1: TIER_Y[tier] + NODE_R,
        x2: colX, y2: TIER_Y[nextTier] - NODE_R,
        active,
      });
    });
  });

  const renderNode = (
    cx: number,
    cy: number,
    r: number,
    state: NodeState,
    abbr: string,
    sub: string,
    onEnter: () => void,
    onLeave: () => void,
    onClick?: () => void,
  ) => {
    const s = NODE_STYLE[state];
    const clickable = state === 'available';
    return (
      <g
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={clickable ? onClick : undefined}
        style={{ cursor: clickable ? 'pointer' : 'default' }}
      >
        {/* glow halo for selected */}
        {state === 'selected' && (
          <circle cx={cx} cy={cy} r={r + 9} fill="#4a8a28" opacity={0.18} />
        )}
        {/* dashed outer ring for available */}
        {state === 'available' && (
          <circle
            cx={cx} cy={cy} r={r + 7}
            fill="none" stroke="#b0d860" strokeWidth={1}
            strokeDasharray="4 5" opacity={0.55}
          />
        )}
        {/* main circle */}
        <circle
          cx={cx} cy={cy} r={r}
          fill={s.fill} stroke={s.stroke}
          strokeWidth={s.sw}
          strokeDasharray={s.dash}
          filter={s.glow ? 'url(#wb-glow)' : undefined}
        />
        {/* abbreviation */}
        <text
          x={cx} y={cy - 4}
          textAnchor="middle" dominantBaseline="middle"
          fill={s.tc} fontSize={r === BASE_R ? 8 : 9}
          fontFamily="ui-monospace,monospace" fontWeight="bold"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {abbr}
        </text>
        {/* sub-label */}
        <text
          x={cx} y={cy + 7}
          textAnchor="middle" dominantBaseline="middle"
          fill={s.tc} fontSize={6.5}
          fontFamily="ui-monospace,monospace" opacity={0.6}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {sub}
        </text>
      </g>
    );
  };

  return (
    <div
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHovered(null)}
    >
      {/* floating tooltip — portal to body to escape HudWindow transform context */}
      {hovered && typeof document !== 'undefined' && createPortal(
        (() => {
          const tw = tooltipRef.current?.offsetWidth ?? 220;
          const th = tooltipRef.current?.offsetHeight ?? 80;
          const ox = 10;
          const oy = 10;
          const left = mousePos.x + ox + tw + 8 > window.innerWidth
            ? mousePos.x - tw - ox
            : mousePos.x + ox;
          const top = mousePos.y + oy + th + 8 > window.innerHeight
            ? mousePos.y - th - oy
            : mousePos.y + oy;
          return (
            <div
              ref={tooltipRef}
              className="pointer-events-none fixed z-[9999] max-w-[240px] rounded-xl border border-[#a8d96e]/25 bg-[#0d1a08]/95 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
              style={{ left, top }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold ${
                    hovered.state === 'selected' || hovered.state === 'base'
                      ? 'text-[#d4edac]'
                      : hovered.state === 'available'
                        ? 'text-[#c0df98]'
                        : 'text-[#6a8a50]'
                  }`}
                >
                  {hovered.title}
                </span>
                {hovered.isPlaceholder && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#222e18]/70 text-[#6a8a50]">
                    Coming soon
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-[#6a8a50]">{hovered.description}</div>
              {hovered.statLines && hovered.statLines.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hovered.statLines.map((line) => (
                    <span
                      key={line}
                      className="rounded border border-[#a8d96e]/25 bg-[#1a3510]/70 px-2 py-0.5 text-[11px] font-semibold text-[#a8d96e]"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })(),
        document.body,
      )}

      <svg
        width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto block"
        style={{ filter: 'drop-shadow(0 0 10px rgba(80,160,60,0.12))' }}
      >
        <defs>
          <filter id="wb-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* subtle radial background gradient */}
          <radialGradient id="wb-bg" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#162c09" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0a1306" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        {/* background */}
        <rect width={W} height={H} rx={10} fill="url(#wb-bg)" />

        {/* grid dots */}
        {Array.from({ length: 7 }, (_, col) =>
          Array.from({ length: 15 }, (_, row) => (
            <circle
              key={`dot-${col}-${row}`}
              cx={col * 48 + 8} cy={row * 78 + 24}
              r={0.9} fill="#2a4018" opacity={0.5}
            />
          )),
        )}

        {/* tier labels on left margin */}
        {TIERS.map((tier) => (
          <text
            key={`tier-lbl-${tier}`}
            x={LEFT_X - 32} y={TIER_Y[tier]}
            textAnchor="middle" dominantBaseline="middle"
            fill="#3a5820" fontSize={8}
            fontFamily="ui-monospace,monospace"
            style={{ userSelect: 'none' }}
          >
            T{tier}
          </text>
        ))}

        {/* ── lines (drawn below nodes so nodes paint on top) ── */}
        {lineSegments.map((l, i) => (
          <line
            key={`line-${i}`}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.active ? LINE_ACTIVE.stroke : LINE_INACTIVE.stroke}
            strokeWidth={l.active ? LINE_ACTIVE.sw : LINE_INACTIVE.sw}
            strokeLinecap="round"
          />
        ))}

        {/* ── junction diamonds: T1-T10 and T14-T20; column sections skip junctions ── */}
        {(JY as unknown as number[]).filter((_, idx) => idx < 9 || (idx >= 13 && idx <= 18)).map((jY, renderIdx) => {
          // Map renderIdx back to original jIdx to compute active state correctly
          const jIdx = renderIdx < 9 ? renderIdx : renderIdx - 9 + 13;
          const active = weapon.level >= jIdx + 1;
          return (
            <rect
              key={`j-${jIdx}`}
              x={CX - JUNCTION_R} y={jY - JUNCTION_R}
              width={JUNCTION_R * 2} height={JUNCTION_R * 2}
              transform={`rotate(45,${CX},${jY})`}
              fill={active ? '#4e8c2a' : '#152209'}
              stroke={active ? '#8ecf50' : '#253a14'}
              strokeWidth={0.8}
            />
          );
        })}

        {/* ── base node ── */}
        {renderNode(
          CX, TIER_Y[1], BASE_R,
          'base', 'LV1', 'BASE',
          () => setHovered({ title: weapon.title, description: weapon.subtitle, state: 'base' }),
          () => setHovered(null),
        )}

        {/* ── tier nodes ── */}
        {TIERS.flatMap((tier) => {
          const tierData = weapon.allTierChoices.find((tc) => tc.tier === tier);
          if (!tierData) return [];
          return tierData.choices.map((choice, idx) => {
            const x = idx === 0 ? LEFT_X : RIGHT_X;
            const y = TIER_Y[tier];
            const state = getNodeState(tier, choice.id);
            return (
              <g key={choice.id}>
                {renderNode(
                  x, y, NODE_R,
                  state,
                  initials(choice.title),
                  `T${tier}`,
                  () => setHovered({ title: choice.title, description: choice.description, state, isPlaceholder: choice.isPlaceholder, statLines: choice.statLines }),
                  () => setHovered(null),
                  state === 'available' ? () => onApplyUpgradeChoice(choice.id) : undefined,
                )}
              </g>
            );
          });
        })}
      </svg>

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkbenchWindow({
  isOpen,
  tab,
  onTabChange,
  woodCount,
  canCraft,
  isCrafting,
  hasPendingPickup,
  progress,
  status,
  onCraft,
  onCollect,
  upgradeableWeapons,
  selectedUpgradeableWeaponKey,
  onSelectUpgradeableWeapon,
  onApplyUpgradeChoice,
  onResetUpgrades,
  onClose,
}: WorkbenchWindowProps) {
  if (!isOpen) {
    return null;
  }

  const craftButtonEnabled = hasPendingPickup || canCraft;
  const craftButtonLabel = hasPendingPickup ? 'Collect' : isCrafting ? 'Crafting...' : 'Craft';
  const craftButtonAction = hasPendingPickup ? onCollect : onCraft;
  const selectedUpgradeableWeapon = selectedUpgradeableWeaponKey
    ? upgradeableWeapons.find((weapon) => weapon.key === selectedUpgradeableWeaponKey) ?? null
    : upgradeableWeapons[0] ?? null;
  const canResetSelectedWeapon = Boolean(selectedUpgradeableWeapon?.selectedUpgrades.length);
  const selectedUpgradeByLevel = new Map(
    (selectedUpgradeableWeapon?.selectedUpgrades ?? []).map((upgrade) => [upgrade.level, upgrade]),
  );

  return (
    <HudWindow
      title="Workbench"
      subtitle="Crafting"
      storageKey="mmorpg.ui.workbench.position.v1"
      defaultPosition={{ left: 420, top: 180 }}
      onClose={onClose}
      headerActions={
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/items/equipment/workbench-16x16.png"
          alt="Workbench"
          draggable={false}
          className="pixelated h-8 w-8 rounded-lg border border-[#d9efbd]/20 bg-[#102108]/60 p-1"
        />
      }
      className="z-30 w-[540px] max-w-[94vw] border-[#d9efbd]/35 bg-[#17320d]/82"
    >
      <div className="space-y-4">
        {/* tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onTabChange('craft')}
            className={`rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              tab === 'craft'
                ? 'border-[#d9efbd]/55 bg-[#d7f0b6] text-[#18310d]'
                : 'border-[#d9efbd]/18 bg-[#203b11]/45 text-[#cfe1ba] hover:bg-[#294816]/72'
            }`}
          >
            Craft
          </button>
          <button
            type="button"
            onClick={() => onTabChange('upgrade')}
            className={`rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              tab === 'upgrade'
                ? 'border-[#d9efbd]/55 bg-[#d7f0b6] text-[#18310d]'
                : 'border-[#d9efbd]/18 bg-[#203b11]/45 text-[#cfe1ba] hover:bg-[#294816]/72'
            }`}
          >
            Upgrade
          </button>
        </div>

        {tab === 'craft' ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Recipe</div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d9efbd]/20 bg-[#102108]/60">
                    <ItemIcon item={ITEM_DEFINITIONS.wood_staff} className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#f4ffe8]">Wood Staff</div>
                    <div className="text-xs text-[#cfe1ba]">Craft time: 10s</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!craftButtonEnabled}
                  onClick={craftButtonAction}
                  className={`rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    craftButtonEnabled
                      ? 'border-[#d9efbd]/30 bg-[#d7f0b6] text-[#18310d] hover:bg-[#e7f8cf]'
                      : 'cursor-not-allowed border-[#d9efbd]/14 bg-[#203b11]/35 text-[#88a26e]'
                  }`}
                >
                  {craftButtonLabel}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9efbd]/20 bg-[#102108]/60">
                    <ItemIcon item={ITEM_DEFINITIONS.wood} className="h-6 w-6" />
                  </div>
                  <div className="text-sm text-[#d8ebc7]">Wood</div>
                </div>
                <div className={`text-xs font-semibold ${woodCount >= 5 ? 'text-[#d7f0b6]' : 'text-[#ffcf8a]'}`}>
                  {woodCount} / 5
                </div>
              </div>

              {isCrafting ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">
                    <span>Progress</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full border border-[#d9efbd]/20 bg-[#102108]/60">
                    <div
                      className="h-full rounded-full bg-[#d7f0b6]"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {status ? (
              <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-3 text-sm text-[#d8ebc7]">
                {status}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="max-h-[min(72vh,700px)] overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-[168px_minmax(0,1fr)]">
              {/* weapon list */}
              <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Weapons</div>
                <div className="mt-3 space-y-2">
                  {upgradeableWeapons.length > 0 ? (
                    upgradeableWeapons.map((weapon) => {
                      const isSelected = selectedUpgradeableWeapon?.key === weapon.key;
                      return (
                        <button
                          key={weapon.key}
                          type="button"
                          onClick={() => onSelectUpgradeableWeapon(weapon.key)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            isSelected
                              ? 'border-[#d9efbd]/55 bg-[#d7f0b6] text-[#18310d]'
                              : 'border-[#d9efbd]/18 bg-[#203b11]/45 text-[#d8ebc7] hover:bg-[#294816]/72'
                          }`}
                        >
                          <div className="text-sm font-semibold">{weapon.title}</div>
                          <div
                            className={`mt-1 text-[10px] uppercase tracking-[0.18em] ${isSelected ? 'text-[#35511e]' : 'text-[#9fbc7e]'}`}
                          >
                            {weapon.sourceLabel}
                          </div>
                          <div className={`mt-2 text-xs ${isSelected ? 'text-[#264116]' : 'text-[#cfe1ba]'}`}>
                            Level {weapon.level}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-3 text-sm text-[#9fbc7e]">
                      No upgradeable weapons found.
                    </div>
                  )}
                </div>
              </div>

              {/* upgrade tree panel */}
              <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
                {selectedUpgradeableWeapon ? (
                  <>
                    {/* weapon header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d9efbd]/20 bg-[#102108]/60">
                          <ItemIcon item={ITEM_DEFINITIONS.wood_staff} className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#f4ffe8]">
                            {selectedUpgradeableWeapon.title}
                          </div>
                          <div className="text-xs text-[#9fbc7e]">{selectedUpgradeableWeapon.subtitle}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-[#6a8a50]">Level</div>
                          <div className="text-lg font-bold text-[#d4edac]">{selectedUpgradeableWeapon.level}</div>
                        </div>
                        <button
                          type="button"
                          onClick={onResetUpgrades}
                          disabled={!canResetSelectedWeapon}
                          className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                            canResetSelectedWeapon
                              ? 'border-[#f0c7b6]/30 bg-[#5a2318]/62 text-[#ffe1d6] hover:bg-[#723021]/78'
                              : 'cursor-not-allowed border-[#d9efbd]/12 bg-[#203b11]/30 text-[#4a6535]'
                          }`}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* POE-style tree */}
                    <div className="mt-4">
                      <UpgradeTreeSvg
                        weapon={selectedUpgradeableWeapon}
                        selectedUpgradeByLevel={selectedUpgradeByLevel}
                        onApplyUpgradeChoice={onApplyUpgradeChoice}
                      />
                    </div>

                    {selectedUpgradeableWeapon.nextChoices.length === 0 && (
                      <div className="mt-3 text-sm text-[#d8ebc7]">
                        This weapon has reached the final skill choice.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-3 text-sm text-[#d8ebc7]">
                    Bring a wood staff to the workbench to start upgrading it.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </HudWindow>
  );
}
