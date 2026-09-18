import type { EnemyDef } from '../types/game';

export const ENEMIES: EnemyDef[] = [
  {
    id: 'raider',
    name: 'Налётчик',
    hp: 60,
    speedTilesPerSec: 1.0,
    gateDamage: 1,
    goldReward: 1,
    color: 0xc0392b,
    radius: 10,
  },
  {
    id: 'heavy',
    name: 'Тяжёлый',
    hp: 160,
    speedTilesPerSec: 0.55,
    gateDamage: 2,
    goldReward: 2,
    color: 0x7f1d1d,
    radius: 14,
  },
  {
    id: 'rider',
    name: 'Гонец',
    hp: 35,
    speedTilesPerSec: 1.65,
    gateDamage: 1,
    goldReward: 1,
    color: 0xe67e22,
    radius: 8,
  },
];

export function getEnemy(id: string): EnemyDef {
  const e = ENEMIES.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown enemy: ${id}`);
  return e;
}
