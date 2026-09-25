import { describe, expect, it } from 'vitest';
import { BUILDINGS, UNITS } from '../../src/domain/config';
import { createRun } from '../../src/domain/createRun';
import { GameSimulation } from '../../src/domain/GameSimulation';
import type {
  BuildingKind,
  GameEvent,
  ResourceKey,
  RunResources,
  UnitKind,
  WorkPriority,
} from '../../src/domain/model';

interface BuildOrder {
  kind: BuildingKind;
  plotId: string;
  count?: number;
  priority?: WorkPriority;
}

interface SoakResult {
  status: 'victory' | 'defeat' | 'running';
  day: number;
  gameTime: number;
  buildings: number;
  buildingState: string[];
  units: number;
  enemiesDefeated: number;
  unitsLost: number;
  gateHp: number;
  heroHp: number;
  resources: RunResources;
}

const DEFENSE_FIRST: BuildOrder[] = [
  { kind: 'lumber', plotId: 'settlement-2', priority: 'high' },
  { kind: 'barracks', plotId: 'settlement-3', priority: 'high' },
  { kind: 'tower', plotId: 'defense-1', priority: 'high' },
  { kind: 'house', plotId: 'settlement-4', count: 2 },
  { kind: 'field', plotId: 'settlement-5', priority: 'high' },
  { kind: 'cookhouse', plotId: 'settlement-6', priority: 'high' },
  { kind: 'quarry', plotId: 'settlement-7', priority: 'normal' },
  { kind: 'mine', plotId: 'settlement-8', priority: 'normal' },
  { kind: 'smithy', plotId: 'settlement-9', priority: 'high' },
  { kind: 'tower', plotId: 'defense-2', count: 2, priority: 'high' },
  { kind: 'ward', plotId: 'defense-3', priority: 'normal' },
];

const ECONOMY_FIRST: BuildOrder[] = [
  { kind: 'lumber', plotId: 'settlement-2', priority: 'high' },
  { kind: 'field', plotId: 'settlement-3', priority: 'high' },
  { kind: 'house', plotId: 'settlement-4', count: 2 },
  { kind: 'cookhouse', plotId: 'settlement-5', priority: 'high' },
  { kind: 'quarry', plotId: 'settlement-6', priority: 'normal' },
  { kind: 'mine', plotId: 'settlement-7', priority: 'normal' },
  { kind: 'smithy', plotId: 'settlement-8', priority: 'high' },
  { kind: 'barracks', plotId: 'settlement-9', priority: 'high' },
  { kind: 'tower', plotId: 'defense-1', priority: 'high' },
  { kind: 'ward', plotId: 'defense-2', priority: 'normal' },
];

function canAfford(resources: RunResources, cost: Partial<RunResources>): boolean {
  return (Object.entries(cost) as [ResourceKey, number][]).every(
    ([resource, amount]) => resources[resource] >= amount,
  );
}

function tryBuild(simulation: GameSimulation, order: BuildOrder): void {
  const count = simulation.state.buildings.filter((building) => building.kind === order.kind).length;
  if (count >= (order.count ?? 1) || !canAfford(simulation.state.resources, BUILDINGS[order.kind].cost)) {
    return;
  }
  simulation.dispatch({ type: 'place-building', buildingId: order.kind, plotId: order.plotId });
}

function tryRecruit(simulation: GameSimulation, kind: UnitKind, targetCount: number): void {
  const current = simulation.state.units.filter((unit) => unit.kind === kind).length;
  if (current < targetCount && canAfford(simulation.state.resources, UNITS[kind].cost)) {
    simulation.dispatch({ type: 'recruit-unit', unitId: kind });
  }
}

function managePriorities(simulation: GameSimulation): void {
  for (const building of simulation.state.buildings) {
    if (building.status !== 'active' || BUILDINGS[building.kind].jobs === 0) {
      continue;
    }
    let priority: WorkPriority = 'normal';
    if (building.kind === 'tower' || building.kind === 'ward') {
      priority = 'high';
    } else if (building.kind === 'lumber') {
      priority = simulation.state.resources.wood < 50 ? 'high' : 'low';
    } else if (building.kind === 'quarry') {
      priority = simulation.state.resources.stone < 20 ? 'high' : 'low';
    } else if (building.kind === 'field') {
      priority = simulation.state.resources.grain < 18 ? 'high' : 'normal';
    } else if (building.kind === 'cookhouse') {
      priority = simulation.state.resources.food < 24 ? 'high' : 'normal';
    } else if (building.kind === 'mine') {
      priority = simulation.state.resources.ore < 8 ? 'high' : 'normal';
    } else if (building.kind === 'smithy') {
      priority = simulation.state.resources.weapons < 6 ? 'high' : 'low';
    }
    if (building.priority !== priority) {
      simulation.dispatch({ type: 'set-building-priority', buildingId: building.id, priority });
    }
  }
}
function runSoak(seed: string, orders: BuildOrder[]): SoakResult {
  const simulation = new GameSimulation(createRun(seed));
  let enemiesDefeated = 0;
  let unitsLost = 0;
  simulation.dispatch({ type: 'set-speed', speed: 8 });
  simulation.dispatch({ type: 'set-rally-point', x: 490, y: 365 });

  for (let step = 0; step < 800 && simulation.state.status === 'running'; step += 1) {
    for (const order of orders) {
      tryBuild(simulation, order);
    }

    managePriorities(simulation);


    tryRecruit(simulation, 'warrior', 4);
    tryRecruit(simulation, 'archer', 3);
    tryRecruit(simulation, 'volkhv', 1);

    if (simulation.state.nightActive && simulation.state.hero.abilityCooldown <= 0) {
      simulation.dispatch({ type: 'use-hero-ability' });
    }
    if (!simulation.state.nightActive) {
      const node = simulation.state.exploration.find((candidate) => !candidate.explored);
      if (node && simulation.state.resources.food >= 4) {
        simulation.dispatch({ type: 'explore-node', nodeId: node.id });
      }
    }

    simulation.advance(0.25);
    const events: GameEvent[] = simulation.drainEvents();
    enemiesDefeated += events.filter((event) => event.type === 'enemy-defeated').length;
    unitsLost += events.filter((event) => event.type === 'unit-defeated').length;
  }

  return {
    status: simulation.state.status,
    day: simulation.state.day,
    gameTime: (simulation.state.day - 1) * 240 + simulation.state.timeOfDay,
    buildings: simulation.state.buildings.length,
    buildingState: simulation.state.buildings.map((building) => building.kind + ':' + building.status + ':w' + building.workersAssigned + ':' + building.priority),
    units: simulation.state.units.length,
    enemiesDefeated,
    unitsLost,
    gateHp: simulation.state.gateHp,
    heroHp: simulation.state.hero.hp,
    resources: { ...simulation.state.resources },
  };
}

function expectValidResult(result: SoakResult): void {
  expect(result.status).toBe('victory');
  expect(result.day).toBeGreaterThanOrEqual(2);
  expect(result.gameTime).toBeLessThanOrEqual(1200);
  expect(result.buildings).toBeGreaterThanOrEqual(4);
  expect(result.enemiesDefeated).toBeGreaterThan(0);
  expect(result.gateHp).toBeGreaterThanOrEqual(0);
  expect(result.heroHp).toBeGreaterThanOrEqual(0);
  for (const amount of Object.values(result.resources)) {
    expect(Number.isFinite(amount)).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(0);
  }
}

describe('five-day balance soak', () => {
  it('completes a deterministic defense-first run', () => {
    const first = runSoak('defense-soak', DEFENSE_FIRST);
    const second = runSoak('defense-soak', DEFENSE_FIRST);
    expect(first).toEqual(second);
    expectValidResult(first);
    console.info('defense-first', first);
  });

  it('completes an economy-first run without a softlock', () => {
    const result = runSoak('economy-soak', ECONOMY_FIRST);
    expectValidResult(result);
    console.info('economy-first', result);
  });
});
