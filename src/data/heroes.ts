import type { HeroDef } from '../types/game';

export const HEROES: HeroDef[] = [
  {
    id: 'kolovrat',
    name: 'Евпатий Коловрат',
    title: 'Оборона',
    description: '+30% HP башен, +20% броня, +2 HP врат',
    towerHpBonus: 0.3,
    towerArmorBonus: 0.2,
    gateHpBonus: 2,
    productionIntervalFactor: 1,
    productionYieldBonus: 0,
    taxBonus: 0,
  },
  {
    id: 'galitsky',
    name: 'Данило Галицкий',
    title: 'Экономика',
    description: '−25% интервал добычи, +25% выход и налог',
    towerHpBonus: 0,
    towerArmorBonus: 0,
    gateHpBonus: 0,
    productionIntervalFactor: 0.75,
    productionYieldBonus: 0.25,
    taxBonus: 0.25,
  },
];

export function getHero(id: string): HeroDef {
  const hero = HEROES.find((h) => h.id === id);
  if (!hero) throw new Error(`Unknown hero: ${id}`);
  return hero;
}
