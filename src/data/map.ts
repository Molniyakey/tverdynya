import { TILE_SIZE } from './constants';
import type { TileKind } from '../types/game';

/**
 * Карта в духе Super Fantasy Kingdom:
 * - сверху большая Округа (дикие земли, сторона Орды)
 * - стена с воротами
 * - снизу поселение
 *
 * Мир в координатах 0..MAP_PIXEL_*; камера показывает только VIEW_W×VIEW_H.
 */
export const MAP_COLS = 32;
export const MAP_ROWS = 22;

/** Ряды округи / поля атаки (над стеной) */
export const OUTSKIRTS_ROW_START = 0;
export const OUTSKIRTS_ROW_END = 10;

export const WALL_ROW = 11;
export const SETTLEMENT_ROW_START = 12;
export const SETTLEMENT_ROW_END = 21;

/** Ворота по центру стены */
export const GATE_COL_START = 15;
export const GATE_COL_END = 16;

/** Левая UI-панель (экранные пиксели, не мир) */
export const LEFT_PANEL_W = 150;
/** Видимая область карты (камера) */
export const VIEW_W = 20 * TILE_SIZE; // 960
export const VIEW_H = 14 * TILE_SIZE; // 672
export const BOTTOM_BAR_H = 56;

export const MAP_PIXEL_W = MAP_COLS * TILE_SIZE;
export const MAP_PIXEL_H = MAP_ROWS * TILE_SIZE;
export const GAME_WIDTH = LEFT_PANEL_W + VIEW_W;
export const GAME_HEIGHT = VIEW_H + BOTTOM_BAR_H;

/** @deprecated мир больше не смещён; оставлено для совместимости импортов */
export const MAP_OFFSET_X = 0;

export function createTileGrid(): TileKind[][] {
  const grid: TileKind[][] = [];

  for (let row = 0; row < MAP_ROWS; row++) {
    const line: TileKind[] = [];
    for (let col = 0; col < MAP_COLS; col++) {
      line.push(tileAt(col, row));
    }
    grid.push(line);
  }

  return grid;
}

function tileAt(col: number, row: number): TileKind {
  if (row === WALL_ROW) {
    if (col >= GATE_COL_START && col <= GATE_COL_END) return 'gate';
    return 'wall';
  }

  if (row >= OUTSKIRTS_ROW_START && row <= OUTSKIRTS_ROW_END) {
    // Дорога набега к воротам + расширение у края карты
    const pathHalf = row <= 2 ? 3 : row <= 5 ? 2 : 1;
    const mid = (GATE_COL_START + GATE_COL_END) / 2;
    if (Math.abs(col - mid) <= pathHalf) return 'path';
    return 'outskirts';
  }

  // Поселение: ресурсные ноды + трава
  if (row >= SETTLEMENT_ROW_START && row <= SETTLEMENT_ROW_END) {
    if (col <= 5 && row <= SETTLEMENT_ROW_START + 3) return 'forest';
    if (col >= 7 && col <= 10 && row >= SETTLEMENT_ROW_START + 2 && row <= SETTLEMENT_ROW_START + 5) {
      return 'stone';
    }
    if (col >= 24 && row <= SETTLEMENT_ROW_START + 3) return 'field';
    if (col >= 26 && row <= SETTLEMENT_ROW_START + 5) return 'field';
    return 'grass';
  }

  return 'grass';
}

export function tileToWorld(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function worldToTile(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE),
  };
}

export function isSettlementRow(row: number): boolean {
  return row >= SETTLEMENT_ROW_START && row <= SETTLEMENT_ROW_END;
}

export function isOutskirtsRow(row: number): boolean {
  return row >= OUTSKIRTS_ROW_START && row <= OUTSKIRTS_ROW_END;
}

/** Путь Орды: из округи сверху к воротам (для отладки / legacy) */
export function buildPathWaypoints(_grid: TileKind[][]): { x: number; y: number }[] {
  const mid = GATE_COL_START;
  const ordered: [number, number][] = [];
  for (let row = 1; row <= WALL_ROW; row++) {
    ordered.push([mid, row]);
    ordered.push([GATE_COL_END, row]);
  }
  return ordered.map(([c, r]) => tileToWorld(c, r));
}

export const TILE_COLORS: Record<TileKind, number> = {
  grass: 0x3d5235,
  path: 0x6b5a3e,
  forest: 0x1f4d2e,
  stone: 0x5a5a5a,
  field: 0x8a9a3a,
  gate: 0xa0522d,
  wall: 0x4a453f,
  battle: 0x3a3028,
  outskirts: 0x2a3328,
  blocked: 0x222222,
};
