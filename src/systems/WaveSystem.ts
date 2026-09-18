import { getEnemy } from '../data/enemies';
import { OUTPOST_EXTRA_ENEMIES, TILE_SIZE } from '../data/constants';
import {
  GATE_COL_END,
  GATE_COL_START,
  MAP_COLS,
  WALL_ROW,
  tileToWorld,
} from '../data/map';
import type { WaveDef } from '../types/game';
import type { OutpostTarget } from './VillageSystem';

/**
 * Движение в духе Super Fantasy Kingdom:
 * монстры наплывают на королевство фронтом; часть может идти на заставы.
 */
export interface EnemyInstance {
  id: string;
  enemyId: string;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  gateDamage: number;
  goldReward: number;
  color: number;
  radius: number;
  x: number;
  y: number;
  wavePhase: number;
  waveAmplitude: number;
  waveFreq: number;
  targetGateX: number;
  pace: number;
  alive: boolean;
  slowFactor: number;
  /** Цель: ворота твердыни или застава */
  targetKind: 'gate' | 'outpost';
  outpostId: string | null;
  targetX: number;
  targetY: number;
}

let enemySeq = 1;

export class WaveSystem {
  queue: {
    enemyId: string;
    hpMul: number;
    targetKind: 'gate' | 'outpost';
    outpostId: string | null;
  }[] = [];
  spawnTimer = 0;
  spawnInterval = 0.9;
  active = false;
  finishedSpawning = false;
  private spawnSlot = 0;

  start(wave: WaveDef, outposts: OutpostTarget[]): void {
    this.queue = [];
    const main: { enemyId: string; hpMul: number }[] = [];
    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        main.push({ enemyId: spawn.enemyId, hpMul: wave.hpMul });
      }
    }

    // Распределяем долю основной волны по живым заставам
    const targetIds: (string | null)[] = main.map(() => null);
    let assignIdx = 0;
    for (const op of outposts) {
      const count = Math.max(1, Math.floor(main.length * op.divertShare));
      for (let i = 0; i < count && assignIdx < main.length; i++) {
        targetIds[assignIdx] = op.id;
        assignIdx += 1;
      }
    }
    // Перемешаем, чтобы заставы не забирали только «хвост»
    for (let i = targetIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targetIds[i], targetIds[j]] = [targetIds[j], targetIds[i]];
    }

    for (let i = 0; i < main.length; i++) {
      const opId = targetIds[i];
      this.queue.push({
        enemyId: main[i].enemyId,
        hpMul: main[i].hpMul,
        targetKind: opId ? 'outpost' : 'gate',
        outpostId: opId,
      });
    }

    // Отдельная малая волна на каждую заставу
    for (const op of outposts) {
      for (let i = 0; i < OUTPOST_EXTRA_ENEMIES; i++) {
        this.queue.push({
          enemyId: 'raider',
          hpMul: wave.hpMul * 0.85,
          targetKind: 'outpost',
          outpostId: op.id,
        });
      }
    }

    this.spawnInterval = wave.spawnIntervalSec * 0.85;
    this.spawnTimer = 0.15;
    this.active = true;
    this.finishedSpawning = false;
    this.spawnSlot = 0;
  }

  update(dt: number, enemies: EnemyInstance[], outposts: OutpostTarget[]): void {
    if (!this.active || this.finishedSpawning) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.queue.length > 0) {
      const next = this.queue.shift()!;
      // Если застава уже пала — враг идёт на ворота
      let kind = next.targetKind;
      let opId = next.outpostId;
      if (kind === 'outpost' && opId) {
        const alive = outposts.some((o) => o.id === opId);
        if (!alive) {
          kind = 'gate';
          opId = null;
        }
      }
      enemies.push(
        spawnEnemy(next.enemyId, next.hpMul, this.spawnSlot, kind, opId, outposts),
      );
      this.spawnSlot += 1;
      this.spawnTimer = this.spawnInterval * (0.7 + Math.random() * 0.5);
    }

    if (this.queue.length === 0) {
      this.finishedSpawning = true;
    }
  }

  isWaveCleared(enemies: EnemyInstance[]): boolean {
    return this.finishedSpawning && enemies.every((e) => !e.alive);
  }
}

function gateTargets(): number[] {
  const targets: number[] = [];
  for (let col = GATE_COL_START; col <= GATE_COL_END; col++) {
    targets.push(tileToWorld(col, WALL_ROW).x);
  }
  return targets;
}

function spawnEnemy(
  enemyId: string,
  hpMul: number,
  slot: number,
  targetKind: 'gate' | 'outpost',
  outpostId: string | null,
  outposts: OutpostTarget[],
): EnemyInstance {
  const def = getEnemy(enemyId);
  const maxHp = Math.round(def.hp * hpMul);
  const gates = gateTargets();

  const margin = TILE_SIZE * 1.5;
  const usable = MAP_COLS * TILE_SIZE - margin * 2;
  const laneCount = 9;
  const lane = slot % laneCount;
  let laneX = margin + (usable * (lane + 0.5)) / laneCount;
  const jitterX = (Math.random() - 0.5) * TILE_SIZE * 0.9;
  const jitterY = Math.random() * TILE_SIZE * 0.6;

  let targetX = gates[slot % gates.length];
  let targetY = WALL_ROW * TILE_SIZE + TILE_SIZE * 0.35;

  if (targetKind === 'outpost' && outpostId) {
    const op = outposts.find((o) => o.id === outpostId);
    if (op) {
      targetX = op.x;
      targetY = op.y;
      // Спавн ближе к колонке заставы
      laneX = op.x + (Math.random() - 0.5) * TILE_SIZE * 2;
    }
  }

  return {
    id: `e${enemySeq++}`,
    enemyId,
    hp: maxHp,
    maxHp,
    speed: def.speedTilesPerSec * TILE_SIZE,
    baseSpeed: def.speedTilesPerSec * TILE_SIZE,
    gateDamage: def.gateDamage,
    goldReward: def.goldReward,
    color: def.color,
    radius: def.radius,
    x: laneX + jitterX,
    y: TILE_SIZE * 0.35 + jitterY,
    wavePhase: Math.random() * Math.PI * 2,
    waveAmplitude: 28 + Math.random() * 36,
    waveFreq: 1.6 + Math.random() * 1.4,
    targetGateX: targetX,
    pace: 0.88 + Math.random() * 0.28,
    alive: true,
    slowFactor: 0,
    targetKind,
    outpostId,
    targetX,
    targetY,
  };
}

export function retargetFallenOutposts(
  enemies: EnemyInstance[],
  outposts: OutpostTarget[],
): void {
  const gates = gateTargets();
  const gateY = WALL_ROW * TILE_SIZE + TILE_SIZE * 0.35;
  for (const e of enemies) {
    if (!e.alive || e.targetKind !== 'outpost' || !e.outpostId) continue;
    if (outposts.some((o) => o.id === e.outpostId)) continue;
    e.targetKind = 'gate';
    e.outpostId = null;
    e.targetX = gates[0];
    e.targetY = gateY;
    e.targetGateX = gates[0];
  }
}

export function moveEnemiesSurge(
  enemies: EnemyInstance[],
  dt: number,
  timeSec: number,
  onReachGate: (enemy: EnemyInstance) => void,
  onReachOutpost: (enemy: EnemyInstance, outpostId: string) => void,
): void {
  const gateY = WALL_ROW * TILE_SIZE + TILE_SIZE * 0.35;
  const minX = TILE_SIZE * 0.4;
  const maxX = MAP_COLS * TILE_SIZE - TILE_SIZE * 0.4;

  for (const e of enemies) {
    if (!e.alive) continue;

    const speedMul = (1 - Math.min(0.85, e.slowFactor)) * e.pace;
    const speed = e.baseSpeed * speedMul;
    e.slowFactor = 0;

    const goalX = e.targetKind === 'outpost' ? e.targetX : e.targetGateX;
    const goalY = e.targetKind === 'outpost' ? e.targetY : gateY;

    const toX = goalX - e.x;
    const toY = goalY - e.y;

    let dirX = toX * (e.targetKind === 'outpost' ? 0.7 : 0.45);
    let dirY = e.targetKind === 'outpost' ? toY : Math.max(toY, TILE_SIZE * 0.5);
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len;
    dirY /= len;

    const wave = Math.sin(timeSec * e.waveFreq + e.wavePhase) * e.waveAmplitude;
    const ripple = Math.sin(timeSec * 3.1 + e.wavePhase * 1.7) * 10;

    e.x += dirX * speed * dt + (wave + ripple) * dt * (e.targetKind === 'outpost' ? 0.25 : 0.55);
    e.y += dirY * speed * dt;

    for (const other of enemies) {
      if (!other.alive || other.id === e.id) continue;
      const dx = e.x - other.x;
      const dy = e.y - other.y;
      const d = Math.hypot(dx, dy);
      const minDist = e.radius + other.radius + 4;
      if (d > 0 && d < minDist) {
        const push = ((minDist - d) / minDist) * 40 * dt;
        e.x += (dx / d) * push;
        e.y += (dy / d) * push * 0.35;
      }
    }

    e.x = Math.max(minX, Math.min(maxX, e.x));

    const reachDist = e.targetKind === 'outpost' ? TILE_SIZE * 0.55 : 0;
    if (e.targetKind === 'outpost' && e.outpostId) {
      if (Math.hypot(e.x - e.targetX, e.y - e.targetY) <= reachDist) {
        e.alive = false;
        onReachOutpost(e, e.outpostId);
      }
    } else if (e.y >= gateY) {
      e.alive = false;
      onReachGate(e);
    }
  }
}
