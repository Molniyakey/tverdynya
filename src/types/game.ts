export type ResourceKey = 'wood' | 'stone' | 'grain' | 'gold';

export type Resources = Record<ResourceKey, number>;

export type TileKind =
  | 'grass'
  | 'path'
  | 'forest'
  | 'stone'
  | 'field'
  | 'gate'
  | 'wall'
  | 'battle'
  | 'outskirts'
  | 'blocked';

export type BuildingCategory =
  | 'production'
  | 'civic'
  | 'defense'
  | 'unique'
  | 'scout'
  | 'siege';

export type BuildingStatus = 'constructing' | 'active';

export type NeedsNode = 'forest' | 'stone' | 'field' | null;

export type GamePhase = 'build' | 'wave' | 'victory' | 'defeat';

/** Куда можно ставить здание */
export type PlacementRule = 'settlement' | 'wall' | 'siege_forward' | 'wall_or_outpost';

export interface BuildingCost {
  wood?: number;
  stone?: number;
  grain?: number;
  gold?: number;
}

export interface BuildingBuffs {
  towerDamage?: number;
  towerHp?: number;
  productionYield?: number;
  taxBonus?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  cost: BuildingCost;
  buildTimeSec: number;
  completionGold: number;
  needsNode: NeedsNode;
  produces?: Partial<Resources>;
  taxGoldPerTick?: number;
  buffs?: BuildingBuffs;
  combat?: {
    hp: number;
    armor: number;
    damage: number;
    cooldownSec: number;
    rangeTiles: number;
    aoeTiles?: number;
    slowFactor?: number;
  };
  /** Правило размещения; по умолчанию из category */
  placement?: PlacementRule;
  /** Можно ли улучшать (башни) */
  upgradable?: boolean;
  color: number;
  /** Краткая справка для панели зданий */
  help: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  description: string;
  towerHpBonus: number;
  towerArmorBonus: number;
  gateHpBonus: number;
  productionIntervalFactor: number;
  productionYieldBonus: number;
  taxBonus: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speedTilesPerSec: number;
  gateDamage: number;
  goldReward: number;
  color: number;
  radius: number;
}

export interface WaveSpawn {
  enemyId: string;
  count: number;
}

export interface WaveDef {
  index: number;
  spawns: WaveSpawn[];
  hpMul: number;
  spawnIntervalSec: number;
}
