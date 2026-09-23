export type ResourceKey =
  | 'wood'
  | 'stone'
  | 'grain'
  | 'food'
  | 'ore'
  | 'weapons'
  | 'silver';

export type RunResources = Record<ResourceKey, number>;
export type WorkPriority = 'high' | 'normal' | 'low' | 'disabled';
export type RunStatus = 'running' | 'victory' | 'defeat';
export type BuildingKind =
  | 'house'
  | 'lumber'
  | 'quarry'
  | 'field'
  | 'cookhouse'
  | 'mine'
  | 'smithy'
  | 'barracks'
  | 'tower'
  | 'ward';
export type UnitKind = 'warrior' | 'archer' | 'volkhv';
export type EnemyKind = 'ghoul' | 'mara' | 'leshyk' | 'morok';

export interface WorldPoint {
  x: number;
  y: number;
}

export interface PopulationState {
  total: number;
  assigned: number;
  available: number;
}

export interface BuildingState {
  id: string;
  kind: BuildingKind;
  plotId: string;
  status: 'constructing' | 'active';
  constructionRemaining: number;
  priority: WorkPriority;
  workersAssigned: number;
  productionProgress: number;
  hp: number;
  attackCooldown: number;
}

export interface PlotState extends WorldPoint {
  id: string;
  zone: 'settlement' | 'defense';
  bonus: ResourceKey | null;
  occupiedBy: string | null;
}

export interface UnitState extends WorldPoint {
  id: string;
  kind: UnitKind;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  rallyPoint: WorldPoint;
}

export interface EnemyState extends WorldPoint {
  id: string;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  rewardSilver: number;
}

export interface HeroState extends WorldPoint {
  id: 'kolovrat';
  hp: number;
  maxHp: number;
  attackCooldown: number;
  abilityCooldown: number;
  abilityBuffRemaining: number;
  rallyPoint: WorldPoint;
}

export interface ExplorationNodeState extends WorldPoint {
  id: string;
  title: string;
  explored: boolean;
  reward: Partial<RunResources>;
}

export interface SpawnOrder {
  kind: EnemyKind;
  remaining: number;
  interval: number;
  timer: number;
}

export interface RunState {
  version: number;
  seed: string;
  rngState: number;
  nextId: number;
  chapterId: 'first-fortress';
  day: number;
  timeOfDay: number;
  speed: 0 | 1 | 2;
  nightActive: boolean;
  nightResolved: boolean;
  resources: RunResources;
  population: PopulationState;
  buildings: BuildingState[];
  plots: PlotState[];
  units: UnitState[];
  enemies: EnemyState[];
  spawnQueue: SpawnOrder[];
  exploration: ExplorationNodeState[];
  hero: HeroState;
  gateHp: number;
  gateMaxHp: number;
  status: RunStatus;
  tutorialStep: number;
}

export type GameCommand =
  | { type: 'place-building'; buildingId: BuildingKind; plotId: string }
  | { type: 'set-building-priority'; buildingId: string; priority: WorkPriority }
  | { type: 'recruit-unit'; unitId: UnitKind }
  | { type: 'set-rally-point'; x: number; y: number }
  | { type: 'use-hero-ability'; target?: WorldPoint }
  | { type: 'explore-node'; nodeId: string }
  | { type: 'set-speed'; speed: 0 | 1 | 2 };

export type GameEvent =
  | { type: 'command-rejected'; reason: string }
  | { type: 'building-completed'; buildingId: string }
  | { type: 'resource-produced'; resource: ResourceKey; amount: number }
  | { type: 'night-started'; day: number }
  | { type: 'dawn-started'; day: number }
  | { type: 'enemy-defeated'; enemy: EnemyKind }
  | { type: 'unit-defeated'; unit: UnitKind }
  | { type: 'gate-damaged'; amount: number }
  | { type: 'hero-ability-used' }
  | { type: 'node-explored'; nodeId: string; title: string }
  | { type: 'run-ended'; status: Exclude<RunStatus, 'running'> };

export interface GameSettings {
  masterVolume: number;
  fullscreen: boolean;
}

export interface ProfileSave {
  version: number;
  unlockedHeroIds: string[];
  unlockedBuildingIds: string[];
  unlockedRelicIds: string[];
  storyFlags: string[];
  settings: GameSettings;
}

export interface RunSave {
  version: number;
  savedAt: string;
  state: RunState;
}
