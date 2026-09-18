import type { BuildingDef, BuildingStatus } from '../types/game';
import type { HeroDef } from '../types/game';
import { getTowerUpgradeCost, towerDamageMul, towerRangeMul } from '../data/upgrades';
import type { Economy } from './Economy';

export interface PlacedBuilding {
  instanceId: string;
  def: BuildingDef;
  col: number;
  row: number;
  status: BuildingStatus;
  buildProgress: number;
  hp: number;
  maxHp: number;
  cooldownLeft: number;
  /** Уровень апгрейда (0 = база) */
  upgradeLevel: number;
}

let nextId = 1;

export function createPlacedBuilding(
  def: BuildingDef,
  col: number,
  row: number,
  hero: HeroDef,
  uniqueHpBonus: number,
): PlacedBuilding {
  const baseHp = def.combat?.hp ?? 1;
  const isCombat =
    def.category === 'defense' || def.category === 'siege';
  const hpMul = 1 + hero.towerHpBonus + (isCombat ? uniqueHpBonus : 0);
  const maxHp = Math.round(baseHp * hpMul);

  return {
    instanceId: `b${nextId++}`,
    def,
    col,
    row,
    status: 'constructing',
    buildProgress: 0,
    hp: maxHp,
    maxHp,
    cooldownLeft: 0,
    upgradeLevel: 0,
  };
}

export function countConstructing(buildings: PlacedBuilding[]): number {
  return buildings.filter((b) => b.status === 'constructing').length;
}

export function getActiveBuffs(buildings: PlacedBuilding[]): {
  towerDamage: number;
  towerHp: number;
  productionYield: number;
  taxBonus: number;
} {
  let towerDamage = 0;
  let towerHp = 0;
  let productionYield = 0;
  let taxBonus = 0;

  for (const b of buildings) {
    if (b.status !== 'active' || !b.def.buffs) continue;
    towerDamage += b.def.buffs.towerDamage ?? 0;
    towerHp += b.def.buffs.towerHp ?? 0;
    productionYield += b.def.buffs.productionYield ?? 0;
    taxBonus += b.def.buffs.taxBonus ?? 0;
  }

  return { towerDamage, towerHp, productionYield, taxBonus };
}

export function getCombatStats(b: PlacedBuilding): {
  damage: number;
  rangeTiles: number;
  cooldownSec: number;
  aoeTiles?: number;
  slowFactor?: number;
} | null {
  if (!b.def.combat) return null;
  const c = b.def.combat;
  return {
    damage: c.damage * towerDamageMul(b.upgradeLevel),
    rangeTiles: c.rangeTiles * towerRangeMul(b.upgradeLevel),
    cooldownSec: c.cooldownSec,
    aoeTiles: c.aoeTiles,
    slowFactor: c.slowFactor,
  };
}

export function tryUpgradeTower(b: PlacedBuilding, economy: Economy): string | null {
  if (b.status !== 'active' || !b.def.upgradable || !b.def.combat) {
    return 'Это здание нельзя улучшить';
  }
  const cost = getTowerUpgradeCost(b.upgradeLevel);
  if (!cost) return 'Башня уже максимального уровня';
  if (!economy.canAfford(cost)) return 'Не хватает ресурсов на апгрейд';
  economy.pay(cost);
  b.upgradeLevel += 1;
  return null;
}
