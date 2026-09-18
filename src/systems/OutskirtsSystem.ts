import {
  BASE_VISION_FROM_WALL,
  SCOUT_VISION_FROM_WALL,
} from '../data/constants';
import { WALL_ROW } from '../data/map';
import {
  EXPLORE_COST,
  OUTSKIRTS_ACTIVITIES,
  type OutskirtsActivityDef,
} from '../data/outskirts';
import type { BuildingCost, Resources } from '../types/game';
import type { Economy } from './Economy';

export interface OutskirtsRuntimeActivity {
  def: OutskirtsActivityDef;
  claimed: boolean;
}

export class OutskirtsSystem {
  explored = new Set<string>();
  activities: OutskirtsRuntimeActivity[];
  goldEarnedFromOutskirts = 0;

  constructor() {
    this.activities = OUTSKIRTS_ACTIVITIES.map((def) => ({
      def,
      claimed: false,
    }));
  }

  key(col: number, row: number): string {
    return `${col},${row}`;
  }

  isExplored(col: number, row: number): boolean {
    return this.explored.has(this.key(col, row));
  }

  getActivityAt(col: number, row: number): OutskirtsRuntimeActivity | undefined {
    return this.activities.find((a) => a.def.col === col && a.def.row === row);
  }

  exploredCount(): number {
    return this.explored.size;
  }

  claimedCount(): number {
    return this.activities.filter((a) => a.claimed).length;
  }

  /**
   * Туман войны: поселение и стена всегда видны.
   * Над стеной — полоса от стены; дальше — разведанное или зрение юнита-разведчика.
   */
  isVisible(
    col: number,
    row: number,
    hasScoutHut: boolean,
    scoutSeesTile?: (c: number, r: number) => boolean,
  ): boolean {
    if (row >= WALL_ROW) return true;
    if (this.isExplored(col, row)) return true;
    if (scoutSeesTile?.(col, row)) return true;

    const distFromWall = WALL_ROW - row;
    const vision = hasScoutHut ? SCOUT_VISION_FROM_WALL : BASE_VISION_FROM_WALL;
    return distFromWall <= vision;
  }

  canExplore(
    col: number,
    row: number,
    isOutskirtsTile: boolean,
    isReachable: boolean,
  ): boolean {
    if (!isOutskirtsTile) return false;
    if (this.isExplored(col, row)) return false;
    return isReachable;
  }

  /** Платная ручная разведка */
  explore(col: number, row: number, economy: Economy): boolean {
    if (!economy.canAfford(EXPLORE_COST)) return false;
    economy.pay(EXPLORE_COST);
    this.explored.add(this.key(col, row));
    return true;
  }

  /** Бесплатное открытие (изба разведчиков) */
  exploreFree(col: number, row: number): void {
    this.explored.add(this.key(col, row));
  }

  canClaim(activity: OutskirtsRuntimeActivity, economy: Economy): boolean {
    if (activity.claimed) return false;
    if (!this.isExplored(activity.def.col, activity.def.row)) return false;
    return economy.canAfford(activity.def.claimCost);
  }

  claim(activity: OutskirtsRuntimeActivity, economy: Economy): boolean {
    if (!this.canClaim(activity, economy)) return false;
    economy.pay(activity.def.claimCost);
    activity.claimed = true;
    return true;
  }

  produceTick(economy: Economy, yieldMul: number): number {
    let goldGained = 0;
    for (const a of this.activities) {
      if (!a.claimed) continue;
      const gained: Partial<Resources> = {};
      for (const key of Object.keys(a.def.produces) as (keyof Resources)[]) {
        const value = a.def.produces[key];
        if (typeof value === 'number') {
          const amount = Math.ceil(value * yieldMul);
          gained[key] = amount;
          if (key === 'gold') goldGained += amount;
        }
      }
      economy.add(gained);
    }
    this.goldEarnedFromOutskirts += goldGained;
    return goldGained;
  }
}

export function formatCostShort(cost: BuildingCost): string {
  const parts: string[] = [];
  if (cost.wood) parts.push(`${cost.wood}д`);
  if (cost.stone) parts.push(`${cost.stone}к`);
  if (cost.grain) parts.push(`${cost.grain}з`);
  if (cost.gold) parts.push(`${cost.gold}зол`);
  return parts.join('/') || '—';
}
