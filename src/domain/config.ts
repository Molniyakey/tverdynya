import type {
  BuildingKind,
  EnemyKind,
  ResourceKey,
  RunResources,
  UnitKind,
} from './model';

export const RUN_VERSION = 1;
export const FIXED_STEP_SEC = 0.05;
export const DAY_LENGTH_SEC = 240;
export const NIGHT_START_SEC = 150;
export const FINAL_DAY = 5;
export const GATE_POSITION = { x: 490, y: 475 } as const;

export interface BuildingDefinition {
  kind: BuildingKind;
  name: string;
  description: string;
  zone: 'settlement' | 'defense';
  cost: Partial<RunResources>;
  buildTime: number;
  jobs: number;
  cycle: number;
  input?: Partial<RunResources>;
  output?: Partial<RunResources>;
  population?: number;
  hp: number;
  attack?: { damage: number; range: number; cooldown: number };
  color: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDefinition> = {
  house: { kind: 'house', name: 'Изба', description: '+2 жителя', zone: 'settlement', cost: { wood: 10 }, buildTime: 8, jobs: 0, cycle: 0, population: 2, hp: 60, color: 0x9b6a42 },
  lumber: { kind: 'lumber', name: 'Лесной двор', description: 'Производит дерево', zone: 'settlement', cost: { wood: 8 }, buildTime: 8, jobs: 2, cycle: 5, output: { wood: 2 }, hp: 55, color: 0x557a46 },
  quarry: { kind: 'quarry', name: 'Каменоломня', description: 'Производит камень', zone: 'settlement', cost: { wood: 10 }, buildTime: 10, jobs: 2, cycle: 7, output: { stone: 2 }, hp: 65, color: 0x777b80 },
  field: { kind: 'field', name: 'Поле', description: 'Выращивает зерно', zone: 'settlement', cost: { wood: 6 }, buildTime: 6, jobs: 2, cycle: 5, output: { grain: 3 }, hp: 40, color: 0xa89b4a },
  cookhouse: { kind: 'cookhouse', name: 'Поварня', description: '2 зерна → 3 еды', zone: 'settlement', cost: { wood: 12, stone: 4 }, buildTime: 10, jobs: 2, cycle: 7, input: { grain: 2 }, output: { food: 3 }, hp: 55, color: 0xb47743 },
  mine: { kind: 'mine', name: 'Рудник', description: 'Добывает руду', zone: 'settlement', cost: { wood: 12, stone: 5 }, buildTime: 12, jobs: 2, cycle: 8, output: { ore: 2 }, hp: 65, color: 0x58616b },
  smithy: { kind: 'smithy', name: 'Кузница', description: '2 руды → 1 оружие', zone: 'settlement', cost: { wood: 15, stone: 8 }, buildTime: 14, jobs: 2, cycle: 9, input: { ore: 2 }, output: { weapons: 1 }, hp: 70, color: 0x8f4b38 },
  barracks: { kind: 'barracks', name: 'Дружинный двор', description: 'Позволяет нанимать дружину', zone: 'settlement', cost: { wood: 18, stone: 6 }, buildTime: 15, jobs: 1, cycle: 0, hp: 85, color: 0x8c3945 },
  tower: { kind: 'tower', name: 'Вышка', description: 'Обстреливает Навь', zone: 'defense', cost: { wood: 12, stone: 10 }, buildTime: 12, jobs: 1, cycle: 0, hp: 100, attack: { damage: 10, range: 175, cooldown: 1.2 }, color: 0x72523c },
  ward: { kind: 'ward', name: 'Обережный столб', description: 'Поддерживает защитников', zone: 'defense', cost: { wood: 10, silver: 2 }, buildTime: 10, jobs: 1, cycle: 0, hp: 75, color: 0x467786 },
};

export interface UnitDefinition {
  kind: UnitKind;
  name: string;
  cost: Partial<RunResources>;
  hp: number;
  damage: number;
  range: number;
  cooldown: number;
  speed: number;
  color: number;
}

export const UNITS: Record<UnitKind, UnitDefinition> = {
  warrior: { kind: 'warrior', name: 'Ратник', cost: { food: 4, weapons: 1 }, hp: 55, damage: 9, range: 22, cooldown: 0.8, speed: 62, color: 0xc5a05a },
  archer: { kind: 'archer', name: 'Лучник', cost: { food: 4, weapons: 2 }, hp: 34, damage: 8, range: 145, cooldown: 1.1, speed: 58, color: 0x8bb174 },
  volkhv: { kind: 'volkhv', name: 'Волхв', cost: { food: 6, weapons: 1, silver: 1 }, hp: 38, damage: 6, range: 115, cooldown: 1.4, speed: 55, color: 0x75a9b8 },
};

export interface EnemyDefinition {
  kind: EnemyKind;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  range: number;
  cooldown: number;
  rewardSilver: number;
  color: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
  ghoul: { kind: 'ghoul', name: 'Упырь', hp: 25, damage: 5, speed: 34, range: 18, cooldown: 1.1, rewardSilver: 0, color: 0x77905c },
  mara: { kind: 'mara', name: 'Мара', hp: 18, damage: 7, speed: 48, range: 20, cooldown: 0.9, rewardSilver: 0, color: 0x8b79a5 },
  leshyk: { kind: 'leshyk', name: 'Лешак', hp: 70, damage: 12, speed: 22, range: 25, cooldown: 1.5, rewardSilver: 1, color: 0x4c704c },
  morok: { kind: 'morok', name: 'Морок', hp: 650, damage: 22, speed: 18, range: 32, cooldown: 1.2, rewardSilver: 8, color: 0x522c61 },
};

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  wood: 'Дерево', stone: 'Камень', grain: 'Зерно', food: 'Еда', ore: 'Руда', weapons: 'Оружие', silver: 'Серебро',
};
