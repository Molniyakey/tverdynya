import type { BuildingCost } from '../types/game';
import {
  TOWER_UPGRADE_DAMAGE_PER_LEVEL,
  TOWER_UPGRADE_MAX_LEVEL,
  TOWER_UPGRADE_RANGE_PER_LEVEL,
} from './constants';

/** Стоимость апгрейда башни на следующий уровень (индекс = текущий уровень) */
export const TOWER_UPGRADE_COSTS: BuildingCost[] = [
  { wood: 12, stone: 6 },
  { wood: 18, stone: 12 },
  { wood: 22, stone: 16, gold: 4 },
];

export function getTowerUpgradeCost(currentLevel: number): BuildingCost | null {
  if (currentLevel >= TOWER_UPGRADE_MAX_LEVEL) return null;
  return TOWER_UPGRADE_COSTS[currentLevel] ?? null;
}

export function towerDamageMul(level: number): number {
  return 1 + level * TOWER_UPGRADE_DAMAGE_PER_LEVEL;
}

export function towerRangeMul(level: number): number {
  return 1 + level * TOWER_UPGRADE_RANGE_PER_LEVEL;
}
