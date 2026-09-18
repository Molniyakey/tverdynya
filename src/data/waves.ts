import type { WaveDef } from '../types/game';

export const WAVES: WaveDef[] = [
  {
    index: 1,
    hpMul: 1.0,
    spawnIntervalSec: 1.0,
    spawns: [{ enemyId: 'raider', count: 5 }],
  },
  {
    index: 2,
    hpMul: 1.1,
    spawnIntervalSec: 0.9,
    spawns: [{ enemyId: 'raider', count: 8 }],
  },
  {
    index: 3,
    hpMul: 1.15,
    spawnIntervalSec: 0.85,
    spawns: [
      { enemyId: 'raider', count: 6 },
      { enemyId: 'rider', count: 2 },
    ],
  },
  {
    index: 4,
    hpMul: 1.25,
    spawnIntervalSec: 0.9,
    spawns: [
      { enemyId: 'raider', count: 5 },
      { enemyId: 'heavy', count: 2 },
    ],
  },
  {
    index: 5,
    hpMul: 1.35,
    spawnIntervalSec: 0.8,
    spawns: [
      { enemyId: 'raider', count: 8 },
      { enemyId: 'rider', count: 3 },
    ],
  },
  {
    index: 6,
    hpMul: 1.45,
    spawnIntervalSec: 0.95,
    spawns: [
      { enemyId: 'heavy', count: 4 },
      { enemyId: 'raider', count: 4 },
    ],
  },
  {
    index: 7,
    hpMul: 1.55,
    spawnIntervalSec: 0.75,
    spawns: [
      { enemyId: 'rider', count: 6 },
      { enemyId: 'raider', count: 4 },
      { enemyId: 'heavy', count: 2 },
    ],
  },
  {
    index: 8,
    hpMul: 1.7,
    spawnIntervalSec: 0.8,
    spawns: [
      { enemyId: 'raider', count: 6 },
      { enemyId: 'heavy', count: 3 },
      { enemyId: 'rider', count: 4 },
    ],
  },
];
