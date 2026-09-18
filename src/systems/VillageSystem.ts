import { VILLAGES, type VillageDef } from '../data/villages';
import { tileToWorld } from '../data/map';
import type { Resources } from '../types/game';
import type { Economy } from './Economy';
import { formatCostShort } from './OutskirtsSystem';

export interface VillageRuntime {
  def: VillageDef;
  /** Клетка деревни открыта разведкой */
  discovered: boolean;
  /** Укреплена как застава */
  fortified: boolean;
  hp: number;
  destroyed: boolean;
}

export interface OutpostTarget {
  id: string;
  x: number;
  y: number;
  divertShare: number;
}

export class VillageSystem {
  villages: VillageRuntime[];

  constructor() {
    this.villages = VILLAGES.map((def) => ({
      def,
      discovered: false,
      fortified: false,
      hp: def.maxHp,
      destroyed: false,
    }));
  }

  getAt(col: number, row: number): VillageRuntime | undefined {
    return this.villages.find((v) => v.def.col === col && v.def.row === row);
  }

  isOutpostTowerSlot(col: number, row: number): boolean {
    return this.villages.some(
      (v) =>
        v.fortified &&
        !v.destroyed &&
        v.def.towerSlots.some((s) => s.col === col && s.row === row),
    );
  }

  getOutpostIdForSlot(col: number, row: number): string | null {
    for (const v of this.villages) {
      if (!v.fortified || v.destroyed) continue;
      if (v.def.towerSlots.some((s) => s.col === col && s.row === row)) {
        return v.def.id;
      }
    }
    return null;
  }

  syncDiscovery(isExplored: (c: number, r: number) => boolean): VillageRuntime[] {
    const newly: VillageRuntime[] = [];
    for (const v of this.villages) {
      if (v.discovered) continue;
      if (isExplored(v.def.col, v.def.row)) {
        v.discovered = true;
        newly.push(v);
      }
    }
    return newly;
  }

  canFortify(v: VillageRuntime, economy: Economy): boolean {
    if (!v.discovered) return false;
    if (v.fortified && !v.destroyed) return false;
    return economy.canAfford(v.def.fortifyCost);
  }

  fortify(v: VillageRuntime, economy: Economy): boolean {
    if (!this.canFortify(v, economy)) return false;
    economy.pay(v.def.fortifyCost);
    v.fortified = true;
    v.hp = v.def.maxHp;
    v.destroyed = false;
    return true;
  }

  /** Между волнами чиним живые заставы */
  mendBetweenWaves(): void {
    for (const v of this.villages) {
      if (v.fortified && !v.destroyed) {
        v.hp = v.def.maxHp;
      }
    }
  }

  /** Живые заставы — цели для части волны */
  activeOutposts(): OutpostTarget[] {
    return this.villages
      .filter((v) => v.fortified && !v.destroyed && v.hp > 0)
      .map((v) => {
        const pos = tileToWorld(v.def.col, v.def.row);
        return {
          id: v.def.id,
          x: pos.x,
          y: pos.y,
          divertShare: v.def.divertShare,
        };
      });
  }

  damageOutpost(id: string, amount: number): VillageRuntime | null {
    const v = this.villages.find((x) => x.def.id === id);
    if (!v || !v.fortified || v.destroyed) return null;
    v.hp -= amount;
    if (v.hp <= 0) {
      v.hp = 0;
      v.destroyed = true;
    }
    return v;
  }

  produceTick(economy: Economy, yieldMul: number): void {
    for (const v of this.villages) {
      if (!v.fortified || v.destroyed) continue;
      const gained: Partial<Resources> = {};
      for (const key of Object.keys(v.def.tribute) as (keyof Resources)[]) {
        const value = v.def.tribute[key];
        if (typeof value === 'number') {
          gained[key] = Math.ceil(value * yieldMul);
        }
      }
      economy.add(gained);
    }
  }

  fortifiedCount(): number {
    return this.villages.filter((v) => v.fortified && !v.destroyed).length;
  }

  fortifyCostLabel(v: VillageRuntime): string {
    return formatCostShort(v.def.fortifyCost);
  }
}
