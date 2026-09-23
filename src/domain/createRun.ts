import { BUILDINGS, GATE_POSITION, RUN_VERSION } from './config';
import type { BuildingState, PlotState, ResourceKey, RunState } from './model';
import { hashSeed, randomInt } from './random';

const SETTLEMENT_POINTS = [
  [220, 535], [345, 545], [470, 565], [600, 545], [730, 565],
  [280, 645], [420, 650], [560, 640], [700, 655], [835, 625],
] as const;

const DEFENSE_POINTS = [[230, 410], [360, 400], [620, 400], [750, 410]] as const;
const BONUSES: ResourceKey[] = ['wood', 'stone', 'grain', 'ore'];

function createPlots(seedState: number): { plots: PlotState[]; rngState: number } {
  let rngState = seedState;
  const settlement = SETTLEMENT_POINTS.map(([x, y], index): PlotState => {
    const roll = randomInt(rngState, 0, BONUSES.length);
    rngState = roll.state;
    return {
      id: `settlement-${index + 1}`,
      x,
      y,
      zone: 'settlement',
      bonus: roll.value === BONUSES.length ? null : BONUSES[roll.value],
      occupiedBy: null,
    };
  });
  const defense = DEFENSE_POINTS.map(([x, y], index): PlotState => ({
    id: `defense-${index + 1}`,
    x,
    y,
    zone: 'defense',
    bonus: null,
    occupiedBy: null,
  }));
  return { plots: [...settlement, ...defense], rngState };
}

export function createRun(seed: string): RunState {
  const initialRng = hashSeed(seed);
  const generated = createPlots(initialRng);
  const houseDef = BUILDINGS.house;
  const house: BuildingState = {
    id: 'building-1',
    kind: 'house',
    plotId: 'settlement-1',
    status: 'active',
    constructionRemaining: 0,
    priority: 'normal',
    workersAssigned: 0,
    productionProgress: 0,
    hp: houseDef.hp,
    attackCooldown: 0,
  };
  generated.plots[0].occupiedBy = house.id;

  return {
    version: RUN_VERSION,
    seed,
    rngState: generated.rngState,
    nextId: 2,
    chapterId: 'first-fortress',
    day: 1,
    timeOfDay: 0,
    speed: 1,
    nightActive: false,
    nightResolved: false,
    resources: { wood: 42, stone: 20, grain: 12, food: 14, ore: 0, weapons: 2, silver: 2 },
    population: { total: 4, assigned: 0, available: 4 },
    buildings: [house],
    plots: generated.plots,
    units: [],
    enemies: [],
    spawnQueue: [],
    exploration: [
      { id: 'old-oak', title: 'Старый дуб', x: 245, y: 115, explored: false, reward: { wood: 12 } },
      { id: 'burial-mound', title: 'Курган', x: 490, y: 90, explored: false, reward: { silver: 3 } },
      { id: 'iron-spring', title: 'Железный ключ', x: 735, y: 125, explored: false, reward: { ore: 8 } },
    ],
    hero: {
      id: 'kolovrat', hp: 160, maxHp: 160, x: GATE_POSITION.x, y: GATE_POSITION.y - 35,
      attackCooldown: 0, abilityCooldown: 0, abilityBuffRemaining: 0,
      rallyPoint: { x: GATE_POSITION.x, y: GATE_POSITION.y - 65 },
    },
    gateHp: 240,
    gateMaxHp: 240,
    status: 'running',
    tutorialStep: 0,
  };
}
