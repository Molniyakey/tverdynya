import type { BuildingCost, Resources } from '../types/game';

export type OutskirtsNodeStatus = 'locked' | 'available' | 'claimed';

export interface OutskirtsActivityDef {
  id: string;
  name: string;
  description: string;
  /** Клетка на карте округи */
  col: number;
  row: number;
  /** Стоимость освоения (после открытия тумана) */
  claimCost: BuildingCost;
  /** Доход за экономический тик */
  produces: Partial<Resources>;
  color: number;
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  /** Тип цели */
  type: 'explore_tiles' | 'claim_activity' | 'outskirts_gold' | 'build_scout' | 'fortify_village';
  target: number;
  /** Для claim_activity — id активности */
  activityId?: string;
  reward: Partial<Resources>;
}

/** Активности на большой округе (со стороны Орды) */
export const OUTSKIRTS_ACTIVITIES: OutskirtsActivityDef[] = [
  {
    id: 'hunting_camp',
    name: 'Охотничий стан',
    description: '+зерно и дерево за тик',
    col: 4,
    row: 3,
    claimCost: { wood: 15, grain: 5 },
    produces: { wood: 1, grain: 2 },
    color: 0x6b4423,
  },
  {
    id: 'fish_bend',
    name: 'Рыбная заводь',
    description: '+зерно за тик',
    col: 27,
    row: 2,
    claimCost: { wood: 10, grain: 8 },
    produces: { grain: 3 },
    color: 0x2a6f8f,
  },
  {
    id: 'wild_quarry',
    name: 'Дикий карьер',
    description: '+камень за тик',
    col: 2,
    row: 6,
    claimCost: { wood: 12, stone: 5 },
    produces: { stone: 2 },
    color: 0x7a7a7a,
  },
  {
    id: 'wayside_shrine',
    name: 'Придорожное капище',
    description: '+золото за тик',
    col: 29,
    row: 7,
    claimCost: { grain: 10, gold: 5 },
    produces: { gold: 1 },
    color: 0x8b6914,
  },
  {
    id: 'caravan_post',
    name: 'Караванный пост',
    description: '+золото и дерево за тик',
    col: 6,
    row: 9,
    claimCost: { wood: 10, grain: 10, gold: 8 },
    produces: { gold: 2, wood: 1 },
    color: 0xb8860b,
  },
  {
    id: 'bee_glade',
    name: 'Пчелиная поляна',
    description: '+зерно и золото за тик',
    col: 14,
    row: 2,
    claimCost: { wood: 8, grain: 6 },
    produces: { grain: 2, gold: 1 },
    color: 0xd4a017,
  },
  {
    id: 'peat_bog',
    name: 'Торфяник',
    description: '+дерево за тик',
    col: 16,
    row: 7,
    claimCost: { wood: 10, stone: 4 },
    produces: { wood: 3 },
    color: 0x4a5a32,
  },
  {
    id: 'flax_field',
    name: 'Льняное поле',
    description: '+зерно и камень (редкий обмен)',
    col: 19,
    row: 8,
    claimCost: { grain: 12, wood: 8 },
    produces: { grain: 2, stone: 1 },
    color: 0x7a9e6a,
  },
];

export const EXPLORE_COST: BuildingCost = { wood: 6 };

export const QUESTS: QuestDef[] = [
  {
    id: 'q_build_scout',
    title: 'Глаза твердыни',
    description: 'Постройте избу разведчиков в поселении',
    type: 'build_scout',
    target: 1,
    reward: { wood: 8, gold: 3 },
  },
  {
    id: 'q_explore_3',
    title: 'Разведка округи',
    description: 'Откройте 3 клетки внешней территории',
    type: 'explore_tiles',
    target: 3,
    reward: { gold: 5 },
  },
  {
    id: 'q_claim_hunt',
    title: 'Первая охота',
    description: 'Освойте охотничий стан',
    type: 'claim_activity',
    target: 1,
    activityId: 'hunting_camp',
    reward: { wood: 10, grain: 5 },
  },
  {
    id: 'q_outskirts_gold',
    title: 'Дань округи',
    description: 'Получите 5 золота с активностей округи',
    type: 'outskirts_gold',
    target: 5,
    reward: { stone: 8, grain: 8 },
  },
  {
    id: 'q_fortify_village',
    title: 'Рубеж округи',
    description: 'Укрепите одну деревню в заставу',
    type: 'fortify_village',
    target: 1,
    reward: { wood: 12, stone: 8, gold: 5 },
  },
];
