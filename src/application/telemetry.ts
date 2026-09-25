import { DAY_LENGTH_SEC } from '../domain/config';
import type {
  BuildingKind,
  GameCommand,
  GameEvent,
  RunResources,
  RunState,
  UnitKind,
} from '../domain/model';

const STORAGE_KEY = 'tverdynya.playtests.v1';
const MAX_SESSIONS = 20;

export interface TelemetrySnapshot {
  day: number;
  timeOfDay: number;
  resources: RunResources;
  population: number;
  assignedWorkers: number;
  buildings: number;
  units: number;
  enemies: number;
  gateHp: number;
  heroHp: number;
}

export interface RunTelemetry {
  version: 1;
  sessionId: string;
  seed: string;
  startedAt: string;
  finishedAt: string | null;
  result: 'victory' | 'defeat' | 'abandoned' | null;
  realDurationSec: number;
  gameDurationSec: number;
  finalDay: number;
  buildingsPlaced: Partial<Record<BuildingKind, number>>;
  unitsRecruited: Partial<Record<UnitKind, number>>;
  exploredNodes: number;
  priorityChanges: number;
  abilitiesUsed: number;
  enemiesDefeated: number;
  unitsLost: number;
  gateDamageTaken: number;
  rejectedCommands: Record<string, number>;
  firstBuildingAtSec: number | null;
  firstUnitAtSec: number | null;
  maxEnemies: number;
  maxUnits: number;
  snapshots: TelemetrySnapshot[];
}

function cloneResources(resources: RunResources): RunResources {
  return { ...resources };
}

export class RunTelemetryRecorder {
  readonly data: RunTelemetry;
  private persisted = false;

  constructor(state: RunState) {
    this.data = {
      version: 1,
      sessionId: `${state.seed}-${Date.now().toString(36)}`,
      seed: state.seed,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      result: null,
      realDurationSec: 0,
      gameDurationSec: (state.day - 1) * DAY_LENGTH_SEC + state.timeOfDay,
      finalDay: state.day,
      buildingsPlaced: {},
      unitsRecruited: {},
      exploredNodes: 0,
      priorityChanges: 0,
      abilitiesUsed: 0,
      enemiesDefeated: 0,
      unitsLost: 0,
      gateDamageTaken: 0,
      rejectedCommands: {},
      firstBuildingAtSec: null,
      firstUnitAtSec: null,
      maxEnemies: state.enemies.length,
      maxUnits: state.units.length,
      snapshots: [],
    };
    this.captureSnapshot(state);
  }

  update(realDeltaSec: number, state: RunState): void {
    this.data.realDurationSec += realDeltaSec;
    this.data.gameDurationSec = (state.day - 1) * DAY_LENGTH_SEC + state.timeOfDay;
    this.data.finalDay = state.day;
    this.data.maxEnemies = Math.max(this.data.maxEnemies, state.enemies.length);
    this.data.maxUnits = Math.max(this.data.maxUnits, state.units.length);
  }

  recordCommand(command: GameCommand): void {
    switch (command.type) {
      case 'place-building':
        this.data.buildingsPlaced[command.buildingId] = (this.data.buildingsPlaced[command.buildingId] ?? 0) + 1;
        this.data.firstBuildingAtSec ??= this.data.gameDurationSec;
        break;
      case 'recruit-unit':
        this.data.unitsRecruited[command.unitId] = (this.data.unitsRecruited[command.unitId] ?? 0) + 1;
        this.data.firstUnitAtSec ??= this.data.gameDurationSec;
        break;
      case 'explore-node':
        this.data.exploredNodes += 1;
        break;
      case 'set-building-priority':
        this.data.priorityChanges += 1;
        break;
      case 'use-hero-ability':
        this.data.abilitiesUsed += 1;
        break;
      case 'set-rally-point':
      case 'set-speed':
        break;
    }
  }

  recordEvents(events: GameEvent[], state: RunState): void {
    for (const event of events) {
      switch (event.type) {
        case 'enemy-defeated':
          this.data.enemiesDefeated += 1;
          break;
        case 'unit-defeated':
          this.data.unitsLost += 1;
          break;
        case 'gate-damaged':
          this.data.gateDamageTaken += event.amount;
          break;
        case 'command-rejected':
          this.data.rejectedCommands[event.reason] = (this.data.rejectedCommands[event.reason] ?? 0) + 1;
          break;
        case 'dawn-started':
          this.captureSnapshot(state);
          break;
        case 'run-ended':
          this.finish(event.status, state);
          break;
        case 'building-completed':
        case 'resource-produced':
        case 'night-started':
        case 'hero-ability-used':
        case 'node-explored':
          break;
      }
    }
  }

  checkpoint(state: RunState): void {
    if (!this.data.finishedAt) {
      this.data.finishedAt = new Date().toISOString();
      this.captureSnapshot(state);
      this.persist();
    }
  }

  abandon(state: RunState): void {
    if (!this.data.finishedAt) {
      this.finish('abandoned', state);
    }
  }

  exportJson(): void {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tverdynya-${this.data.sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private captureSnapshot(state: RunState): void {
    this.data.snapshots.push({
      day: state.day,
      timeOfDay: state.timeOfDay,
      resources: cloneResources(state.resources),
      population: state.population.total,
      assignedWorkers: state.population.assigned,
      buildings: state.buildings.length,
      units: state.units.length,
      enemies: state.enemies.length,
      gateHp: state.gateHp,
      heroHp: state.hero.hp,
    });
  }

  private finish(result: 'victory' | 'defeat' | 'abandoned', state: RunState): void {
    this.data.result = result;
    this.data.finishedAt = new Date().toISOString();
    this.data.finalDay = state.day;
    this.captureSnapshot(state);
    this.persist();
  }

  private persist(): void {
    if (this.persisted) {
      return;
    }
    this.persisted = true;
    const sessions = loadTelemetry();
    sessions.unshift(this.data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  }
}

export function loadTelemetry(): RunTelemetry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as RunTelemetry[] : [];
  } catch {
    return [];
  }
}
