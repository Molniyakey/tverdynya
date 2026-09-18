import type { BuildingCost, Resources } from '../types/game';

/** Деревня на округе: после разведки можно укрепить в заставу */
export interface VillageDef {
  id: string;
  name: string;
  description: string;
  col: number;
  row: number;
  /** Стоимость превращения в заставу */
  fortifyCost: BuildingCost;
  maxHp: number;
  /** Клетки рядом — слоты для башен заставы */
  towerSlots: { col: number; row: number }[];
  /** Доля основной волны, уходящая на эту заставу (если укреплена) */
  divertShare: number;
  /** Дань с заставы за экономический тик */
  tribute: Partial<Resources>;
  color: number;
}

/**
 * Число застав = число деревень, которые можно модернизировать.
 * Появляются на карте после открытия клетки разведкой.
 */
export const VILLAGES: VillageDef[] = [
  {
    id: 'north_hamlet',
    name: 'Северный погост',
    description: 'Укрепите заставу — часть Орды пойдёт на неё',
    col: 10,
    row: 4,
    fortifyCost: { wood: 20, stone: 10, grain: 8 },
    maxHp: 18,
    towerSlots: [
      { col: 9, row: 4 },
      { col: 11, row: 4 },
      { col: 10, row: 3 },
    ],
    divertShare: 0.28,
    tribute: { grain: 1, wood: 1 },
    color: 0xc4a574,
  },
  {
    id: 'east_ves',
    name: 'Восточная весь',
    description: 'Вторая застава: ещё один рубеж до ворот',
    col: 23,
    row: 5,
    fortifyCost: { wood: 22, stone: 12, grain: 10 },
    maxHp: 20,
    towerSlots: [
      { col: 22, row: 5 },
      { col: 24, row: 5 },
      { col: 23, row: 4 },
    ],
    divertShare: 0.28,
    tribute: { stone: 1, grain: 1 },
    color: 0xb8956a,
  },
];

export const FORTIFY_LABEL = 'Укрепить заставу';
