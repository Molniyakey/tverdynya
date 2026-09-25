import {
  BUILDINGS,
  DAY_LENGTH_SEC,
  ENEMIES,
  FINAL_DAY,
  FIXED_STEP_SEC,
  GATE_POSITION,
  NIGHT_START_SEC,
  UNITS,
} from './config';
import type {
  BuildingState,
  EnemyKind,
  EnemyState,
  GameCommand,
  GameEvent,
  ResourceKey,
  RunResources,
  RunState,
  UnitState,
  WorkPriority,
  WorldPoint,
} from './model';
import { randomInt } from './random';

const PRIORITY_ORDER: Record<WorkPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
  disabled: 3,
};

function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveTowards(point: WorldPoint, target: WorldPoint, distanceToMove: number): void {
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const length = Math.hypot(dx, dy);
  if (length <= distanceToMove || length === 0) {
    point.x = target.x;
    point.y = target.y;
    return;
  }
  point.x += (dx / length) * distanceToMove;
  point.y += (dy / length) * distanceToMove;
}

function canAfford(resources: RunResources, cost: Partial<RunResources>): boolean {
  return (Object.entries(cost) as [ResourceKey, number][]).every(
    ([key, amount]) => resources[key] >= amount,
  );
}

function changeResources(
  resources: RunResources,
  values: Partial<RunResources>,
  factor: 1 | -1,
): void {
  for (const [key, amount] of Object.entries(values) as [ResourceKey, number][]) {
    resources[key] += amount * factor;
  }
}

function nearestEnemy(origin: WorldPoint, enemies: EnemyState[], maxRange = Number.POSITIVE_INFINITY): EnemyState | null {
  let selected: EnemyState | null = null;
  let selectedDistance = maxRange;
  for (const enemy of enemies) {
    const currentDistance = distance(origin, enemy);
    if (currentDistance < selectedDistance) {
      selected = enemy;
      selectedDistance = currentDistance;
    }
  }
  return selected;
}

export class GameSimulation {
  readonly state: RunState;
  private accumulator = 0;
  private events: GameEvent[] = [];

  constructor(state: RunState) {
    this.state = state;
    this.recalculateWorkers();
  }

  dispatch(command: GameCommand): void {
    if (this.state.status !== 'running' && command.type !== 'set-speed') {
      return;
    }

    switch (command.type) {
      case 'place-building':
        this.placeBuilding(command.buildingId, command.plotId);
        break;
      case 'set-building-priority': {
        const building = this.state.buildings.find((candidate) => candidate.id === command.buildingId);
        if (building) {
          building.priority = command.priority;
          this.recalculateWorkers();
        }
        break;
      }
      case 'recruit-unit':
        this.recruitUnit(command.unitId);
        break;
      case 'set-rally-point':
        this.state.hero.rallyPoint = { x: command.x, y: command.y };
        for (const unit of this.state.units) {
          unit.rallyPoint = { x: command.x, y: command.y };
        }
        break;
      case 'use-hero-ability':
        if (this.state.hero.abilityCooldown <= 0) {
          this.state.hero.abilityCooldown = 45;
          this.state.hero.abilityBuffRemaining = 15;
          this.events.push({ type: 'hero-ability-used' });
        } else {
          this.reject('Клич рати ещё не готов');
        }
        break;
      case 'explore-node':
        this.exploreNode(command.nodeId);
        break;
      case 'set-speed':
        this.state.speed = command.speed;
        break;
    }
  }

  advance(realDeltaSec: number): void {
    if (this.state.speed === 0 || this.state.status !== 'running') {
      this.accumulator = 0;
      return;
    }
    this.accumulator += Math.min(realDeltaSec, 0.25);
    while (this.accumulator >= FIXED_STEP_SEC) {
      this.tick(FIXED_STEP_SEC * this.state.speed);
      this.accumulator -= FIXED_STEP_SEC;
    }
  }

  drainEvents(): GameEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  private tick(dt: number): void {
    this.updateClock(dt);
    this.updateConstruction(dt);
    this.recalculateWorkers();
    this.updateProduction(dt);
    this.updateSpawns(dt);
    this.updateCombat(dt);
    this.updateCooldowns(dt);
    this.checkEndConditions();
  }

  private updateClock(dt: number): void {
    if (this.state.day === FINAL_DAY && this.state.timeOfDay >= DAY_LENGTH_SEC - 0.01) {
      return;
    }

    const previous = this.state.timeOfDay;
    this.state.timeOfDay += dt;

    if (!this.state.nightActive && previous < NIGHT_START_SEC && this.state.timeOfDay >= NIGHT_START_SEC) {
      this.state.nightActive = true;
      this.state.nightResolved = false;
      this.prepareNight(this.state.day);
      this.events.push({ type: 'night-started', day: this.state.day });
    }

    if (this.state.timeOfDay < DAY_LENGTH_SEC) {
      return;
    }

    if (this.state.day === FINAL_DAY) {
      this.state.timeOfDay = DAY_LENGTH_SEC - 0.01;
      return;
    }

    this.state.day += 1;
    this.state.timeOfDay = 0;
    this.state.nightActive = false;
    this.state.nightResolved = false;
    const foodUpkeep = Math.ceil(this.state.population.total / 2) + this.state.units.length;
    this.state.resources.food = Math.max(0, this.state.resources.food - foodUpkeep);
    this.state.hero.hp = Math.min(
      this.state.hero.maxHp,
      this.state.hero.hp + this.state.hero.maxHp * 0.35,
    );
    for (const unit of this.state.units) {
      unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * 0.25);
    }
    this.events.push({ type: 'dawn-started', day: this.state.day });
  }

  private prepareNight(day: number): void {
    this.state.spawnQueue = [
      { kind: 'ghoul', remaining: 3 + day * 2, interval: Math.max(0.65, 1.2 - day * 0.08), timer: 0 },
    ];
    if (day >= 2) {
      this.state.spawnQueue.push({ kind: 'mara', remaining: day + 1, interval: 1.35, timer: 4 });
    }
    if (day >= 3) {
      this.state.spawnQueue.push({ kind: 'leshyk', remaining: day - 1, interval: 2.2, timer: 8 });
    }
    if (day === FINAL_DAY) {
      this.state.spawnQueue.push({ kind: 'morok', remaining: 1, interval: 1, timer: 14 });
    }
  }

  private updateSpawns(dt: number): void {
    if (!this.state.nightActive) {
      return;
    }
    for (const order of this.state.spawnQueue) {
      order.timer -= dt;
      if (order.remaining > 0 && order.timer <= 0) {
        this.spawnEnemy(order.kind);
        order.remaining -= 1;
        order.timer += order.interval;
      }
    }
    this.state.spawnQueue = this.state.spawnQueue.filter((order) => order.remaining > 0);
  }

  private spawnEnemy(kind: EnemyKind): void {
    const definition = ENEMIES[kind];
    const xRoll = randomInt(this.state.rngState, 120, 860);
    this.state.rngState = xRoll.state;
    this.state.enemies.push({
      id: this.nextId('enemy'),
      kind,
      x: xRoll.value,
      y: 175,
      hp: definition.hp,
      maxHp: definition.hp,
      attackCooldown: 0,
      rewardSilver: definition.rewardSilver,
    });
  }

  private updateConstruction(dt: number): void {
    let completed = false;
    for (const building of this.state.buildings) {
      if (building.status !== 'constructing') {
        continue;
      }
      building.constructionRemaining -= dt;
      if (building.constructionRemaining <= 0) {
        building.constructionRemaining = 0;
        building.status = 'active';
        completed = true;
        this.events.push({ type: 'building-completed', buildingId: building.id });
      }
    }
    if (completed) {
      this.recalculateWorkers();
    }
  }

  private recalculateWorkers(): void {
    const housing = this.state.buildings
      .filter((building) => building.status === 'active')
      .reduce((total, building) => total + (BUILDINGS[building.kind].population ?? 0), 2);
    let available = housing;
    for (const building of this.state.buildings) {
      building.workersAssigned = 0;
    }
    const candidates = this.state.buildings
      .filter((building) => building.status === 'active' && building.priority !== 'disabled')
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.id.localeCompare(b.id));
    for (const building of candidates) {
      const jobs = BUILDINGS[building.kind].jobs;
      building.workersAssigned = Math.min(jobs, available);
      available -= building.workersAssigned;
    }
    this.state.population = {
      total: housing,
      assigned: housing - available,
      available,
    };
  }

  private updateProduction(dt: number): void {
    for (const building of this.state.buildings) {
      const definition = BUILDINGS[building.kind];
      if (
        building.status !== 'active'
        || definition.cycle <= 0
        || building.workersAssigned < definition.jobs
      ) {
        continue;
      }
      building.productionProgress += dt;
      while (building.productionProgress >= definition.cycle) {
        building.productionProgress -= definition.cycle;
        if (definition.input && !canAfford(this.state.resources, definition.input)) {
          building.productionProgress = definition.cycle;
          break;
        }
        if (definition.input) {
          changeResources(this.state.resources, definition.input, -1);
        }
        if (definition.output) {
          const plot = this.state.plots.find((candidate) => candidate.id === building.plotId);
          for (const [resource, baseAmount] of Object.entries(definition.output) as [ResourceKey, number][]) {
            const amount = baseAmount + (plot?.bonus === resource ? 1 : 0);
            this.state.resources[resource] += amount;
            this.events.push({ type: 'resource-produced', resource, amount });
          }
        }
      }
    }
  }

  private updateCombat(dt: number): void {
    const abilityMultiplier = this.state.hero.abilityBuffRemaining > 0 ? 1.5 : 1;
    const activeWards = this.state.buildings.filter((building) => (
      building.kind === 'ward'
      && building.status === 'active'
      && building.workersAssigned === BUILDINGS.ward.jobs
    )).length;
    const damageMultiplier = abilityMultiplier * (1 + activeWards * 0.15);
    this.updateHero(dt, damageMultiplier);
    for (const unit of this.state.units) {
      this.updateUnit(unit, dt, damageMultiplier);
    }
    this.updateTowers(dt, damageMultiplier);
    for (const enemy of this.state.enemies) {
      this.updateEnemy(enemy, dt);
    }

    const fallenUnits = this.state.units.filter((unit) => unit.hp <= 0);
    for (const unit of fallenUnits) {
      this.events.push({ type: 'unit-defeated', unit: unit.kind });
    }
    this.state.units = this.state.units.filter((unit) => unit.hp > 0);

    const fallenEnemies = this.state.enemies.filter((enemy) => enemy.hp <= 0);
    for (const enemy of fallenEnemies) {
      this.state.resources.silver += enemy.rewardSilver;
      this.events.push({ type: 'enemy-defeated', enemy: enemy.kind });
    }
    this.state.enemies = this.state.enemies.filter((enemy) => enemy.hp > 0);

    if (
      this.state.nightActive
      && !this.state.nightResolved
      && this.state.spawnQueue.length === 0
      && this.state.enemies.length === 0
    ) {
      this.state.nightResolved = true;
      this.state.resources.silver += this.state.day;
      this.state.resources.food += 2;
    }
  }

  private updateHero(dt: number, multiplier: number): void {
    const hero = this.state.hero;
    hero.attackCooldown -= dt;
    if (hero.hp <= hero.maxHp * 0.3) {
      moveTowards(hero, { x: GATE_POSITION.x, y: GATE_POSITION.y + 70 }, 82 * dt);
      return;
    }
    const target = nearestEnemy(hero, this.state.enemies, 55);
    if (target && hero.attackCooldown <= 0) {
      target.hp = Math.max(0, target.hp - 16 * multiplier);
      hero.attackCooldown = 0.75;
      return;
    }
    const moveTarget = nearestEnemy(hero.rallyPoint, this.state.enemies, 170) ?? hero.rallyPoint;
    moveTowards(hero, moveTarget, 70 * dt);
  }

  private updateUnit(unit: UnitState, dt: number, multiplier: number): void {
    const definition = UNITS[unit.kind];
    unit.attackCooldown -= dt;
    const detectionRange = Math.max(definition.range + 100, 180);
    const target = nearestEnemy(unit, this.state.enemies, detectionRange);
    if (!target) {
      moveTowards(unit, unit.rallyPoint, definition.speed * dt);
      return;
    }
    if (distance(unit, target) <= definition.range) {
      if (unit.attackCooldown <= 0) {
        target.hp = Math.max(0, target.hp - definition.damage * multiplier);
        if (unit.kind === 'volkhv') {
          for (const ally of this.state.units) {
            if (distance(unit, ally) <= 75) {
              ally.hp = Math.min(ally.maxHp, ally.hp + 2);
            }
          }
        }
        unit.attackCooldown = definition.cooldown;
      }
    } else {
      moveTowards(unit, target, definition.speed * dt);
    }
  }

  private updateTowers(dt: number, multiplier: number): void {
    for (const building of this.state.buildings) {
      const definition = BUILDINGS[building.kind];
      const attack = definition.attack;
      if (!attack || building.status !== 'active' || building.workersAssigned < definition.jobs) {
        continue;
      }
      building.attackCooldown -= dt;
      const plot = this.state.plots.find((candidate) => candidate.id === building.plotId);
      if (!plot) {
        continue;
      }
      const target = nearestEnemy(plot, this.state.enemies, attack.range);
      if (target && building.attackCooldown <= 0) {
        target.hp = Math.max(0, target.hp - attack.damage * multiplier);
        building.attackCooldown = attack.cooldown;
      }
    }
  }

  private updateEnemy(enemy: EnemyState, dt: number): void {
    const definition = ENEMIES[enemy.kind];
    enemy.attackCooldown -= dt;
    let target: (UnitState | RunState['hero']) | null = null;
    let targetDistance = 58;
    for (const defender of [this.state.hero, ...this.state.units]) {
      const currentDistance = distance(enemy, defender);
      if (defender.hp > 0 && currentDistance < targetDistance) {
        target = defender;
        targetDistance = currentDistance;
      }
    }

    if (target) {
      if (targetDistance <= definition.range && enemy.attackCooldown <= 0) {
        target.hp = Math.max(0, target.hp - definition.damage);
        enemy.attackCooldown = definition.cooldown;
      } else {
        moveTowards(enemy, target, definition.speed * dt);
      }
      return;
    }

    const gateDistance = distance(enemy, GATE_POSITION);
    if (gateDistance <= definition.range + 18) {
      if (enemy.attackCooldown <= 0) {
        this.state.gateHp = Math.max(0, this.state.gateHp - definition.damage);
        enemy.attackCooldown = definition.cooldown;
        this.events.push({ type: 'gate-damaged', amount: definition.damage });
      }
    } else {
      moveTowards(enemy, GATE_POSITION, definition.speed * dt);
    }
  }

  private updateCooldowns(dt: number): void {
    this.state.hero.abilityCooldown = Math.max(0, this.state.hero.abilityCooldown - dt);
    this.state.hero.abilityBuffRemaining = Math.max(0, this.state.hero.abilityBuffRemaining - dt);
  }

  private checkEndConditions(): void {
    if (this.state.gateHp <= 0 || this.state.hero.hp <= 0) {
      this.endRun('defeat');
      return;
    }
    if (
      this.state.day === FINAL_DAY
      && this.state.nightResolved
      && !this.state.enemies.some((enemy) => enemy.kind === 'morok')
    ) {
      this.endRun('victory');
    }
  }

  private placeBuilding(kind: keyof typeof BUILDINGS, plotId: string): void {
    const definition = BUILDINGS[kind];
    const plot = this.state.plots.find((candidate) => candidate.id === plotId);
    if (!plot || plot.occupiedBy) {
      this.reject('Участок уже занят');
      return;
    }
    if (plot.zone !== definition.zone) {
      this.reject(definition.zone === 'defense' ? 'Нужен оборонительный участок' : 'Нужен участок поселения');
      return;
    }
    if (!canAfford(this.state.resources, definition.cost)) {
      this.reject('Не хватает ресурсов');
      return;
    }
    changeResources(this.state.resources, definition.cost, -1);
    const building: BuildingState = {
      id: this.nextId('building'),
      kind,
      plotId,
      status: 'constructing',
      constructionRemaining: definition.buildTime,
      priority: 'normal',
      workersAssigned: 0,
      productionProgress: 0,
      hp: definition.hp,
      attackCooldown: 0,
    };
    plot.occupiedBy = building.id;
    this.state.buildings.push(building);
    this.recalculateWorkers();
  }

  private recruitUnit(kind: keyof typeof UNITS): void {
    const hasBarracks = this.state.buildings.some(
      (building) => building.kind === 'barracks' && building.status === 'active',
    );
    if (!hasBarracks) {
      this.reject('Сначала постройте дружинный двор');
      return;
    }
    const definition = UNITS[kind];
    if (!canAfford(this.state.resources, definition.cost)) {
      this.reject('Не хватает еды или оружия');
      return;
    }
    changeResources(this.state.resources, definition.cost, -1);
    const offset = this.state.units.length * 8;
    this.state.units.push({
      id: this.nextId('unit'),
      kind,
      x: GATE_POSITION.x - 35 + offset,
      y: GATE_POSITION.y - 40,
      hp: definition.hp,
      maxHp: definition.hp,
      attackCooldown: 0,
      rallyPoint: { ...this.state.hero.rallyPoint },
    });
  }

  private exploreNode(nodeId: string): void {
    if (this.state.nightActive) {
      this.reject('Ночью округа слишком опасна');
      return;
    }
    const node = this.state.exploration.find((candidate) => candidate.id === nodeId);
    if (!node || node.explored) {
      return;
    }
    const cost = { food: 2 };
    if (!canAfford(this.state.resources, cost)) {
      this.reject('Для похода нужно 2 еды');
      return;
    }
    changeResources(this.state.resources, cost, -1);
    changeResources(this.state.resources, node.reward, 1);
    node.explored = true;
    this.events.push({ type: 'node-explored', nodeId, title: node.title });
  }

  private endRun(status: 'victory' | 'defeat'): void {
    if (this.state.status !== 'running') {
      return;
    }
    this.state.status = status;
    this.state.speed = 0;
    this.events.push({ type: 'run-ended', status });
  }

  private nextId(prefix: string): string {
    const id = `${prefix}-${this.state.nextId}`;
    this.state.nextId += 1;
    return id;
  }

  private reject(reason: string): void {
    this.events.push({ type: 'command-rejected', reason });
  }
}
