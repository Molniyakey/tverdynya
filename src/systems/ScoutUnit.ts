import { TILE_SIZE } from '../data/constants';
import {
  GATE_COL_END,
  GATE_COL_START,
  WALL_ROW,
  tileToWorld,
  worldToTile,
} from '../data/map';

/** Скорость разведчика (px/сек) — свободное перемещение по округе */
export const SCOUT_MOVE_SPEED = 140;
/** Радиус обзора / авто-открытия клеток (в тайлах) */
export const SCOUT_UNIT_VISION_TILES = 2.4;

/**
 * Управляемый разведчик (после избы): ходит по видимой/открытой округе
 * и снимает туман вокруг себя — ближе к SFK, чем клик по клеткам.
 */
export class ScoutUnit {
  active = false;
  x = 0;
  y = 0;
  targetX = 0;
  targetY = 0;
  speed = SCOUT_MOVE_SPEED;
  visionTiles = SCOUT_UNIT_VISION_TILES;

  spawnAtGate(): void {
    const mid = (GATE_COL_START + GATE_COL_END) / 2;
    const pos = tileToWorld(Math.floor(mid), WALL_ROW - 1);
    this.x = pos.x;
    this.y = pos.y;
    this.targetX = pos.x;
    this.targetY = pos.y;
    this.active = true;
  }

  setTarget(x: number, y: number): void {
    if (!this.active) return;
    this.targetX = x;
    this.targetY = y;
  }

  update(
    dt: number,
    canWalk: (col: number, row: number) => boolean,
  ): void {
    if (!this.active) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      this.x = this.targetX;
      this.y = this.targetY;
      return;
    }

    const step = Math.min(this.speed * dt, dist);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    const tile = worldToTile(nx, ny);

    if (canWalk(tile.col, tile.row)) {
      this.x = nx;
      this.y = ny;
      return;
    }

    // Попробовать скольжение по осям (обход узких проходов)
    const tryX = worldToTile(nx, this.y);
    if (canWalk(tryX.col, tryX.row)) {
      this.x = nx;
      return;
    }
    const tryY = worldToTile(this.x, ny);
    if (canWalk(tryY.col, tryY.row)) {
      this.y = ny;
      return;
    }

    // Упёрлись в туман — остановиться
    this.targetX = this.x;
    this.targetY = this.y;
  }

  /** Клетки в радиусе зрения разведчика */
  tilesInVision(): { col: number; row: number }[] {
    if (!this.active) return [];
    const origin = worldToTile(this.x, this.y);
    const r = Math.ceil(this.visionTiles);
    const out: { col: number; row: number }[] = [];
    for (let row = origin.row - r; row <= origin.row + r; row++) {
      for (let col = origin.col - r; col <= origin.col + r; col++) {
        const cx = col * TILE_SIZE + TILE_SIZE / 2;
        const cy = row * TILE_SIZE + TILE_SIZE / 2;
        const d = Math.hypot(cx - this.x, cy - this.y) / TILE_SIZE;
        if (d <= this.visionTiles) out.push({ col, row });
      }
    }
    return out;
  }

  seesTile(col: number, row: number): boolean {
    if (!this.active) return false;
    const cx = col * TILE_SIZE + TILE_SIZE / 2;
    const cy = row * TILE_SIZE + TILE_SIZE / 2;
    return Math.hypot(cx - this.x, cy - this.y) / TILE_SIZE <= this.visionTiles;
  }
}
