export const TICK_SEC = 5;
/** Пауза между волнами после первой */
export const BUILD_PHASE_SEC = 45;
/** Время до первой волны — успеть лес + 1–2 вышки */
export const FIRST_BUILD_PHASE_SEC = 90;
export const WAVE_COUNT = 8;
export const MAX_CONCURRENT_BUILDS = 2;
export const TILE_SIZE = 48;

/** Сколько рядов над стеной видно без избы разведчиков */
export const BASE_VISION_FROM_WALL = 1;
/** С избой — базовая видимость от стены глубже (плюс юнит-разведчик) */
export const SCOUT_VISION_FROM_WALL = 3;
/** Как часто изба сама открывает клетку у края тумана (сек) */
export const SCOUT_REVEAL_INTERVAL_SEC = 6;
/** Скорость панорамирования камеры (px/сек) */
export const CAMERA_PAN_SPEED = 420;

export const START_RESOURCES = {
  wood: 55,
  stone: 25,
  grain: 15,
  gold: 0,
} as const;

export const START_GATE_HP = 20;
export const WAVE_CLEAR_BONUS_GOLD = 3;

/** Макс. уровень апгрейда оборонных башен (0 = базовый) */
export const TOWER_UPGRADE_MAX_LEVEL = 3;
/** +% урона за уровень апгрейда */
export const TOWER_UPGRADE_DAMAGE_PER_LEVEL = 0.25;
/** +% дальности за уровень */
export const TOWER_UPGRADE_RANGE_PER_LEVEL = 0.12;
/** Сколько врагов из доп. волны на каждую живую заставу */
export const OUTPOST_EXTRA_ENEMIES = 3;
/** Ряд сразу за стеной (со стороны Орды) — осадные башни */
export const SIEGE_FORWARD_ROW_OFFSET = 1;
