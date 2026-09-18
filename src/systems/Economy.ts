import type { BuildingCost, Resources } from '../types/game';
import { START_RESOURCES } from '../data/constants';

export class Economy {
  resources: Resources;

  constructor(start: Resources = { ...START_RESOURCES }) {
    this.resources = { ...start };
  }

  canAfford(cost: BuildingCost): boolean {
    return (
      (cost.wood ?? 0) <= this.resources.wood &&
      (cost.stone ?? 0) <= this.resources.stone &&
      (cost.grain ?? 0) <= this.resources.grain &&
      (cost.gold ?? 0) <= this.resources.gold
    );
  }

  pay(cost: BuildingCost): boolean {
    if (!this.canAfford(cost)) return false;
    this.resources.wood -= cost.wood ?? 0;
    this.resources.stone -= cost.stone ?? 0;
    this.resources.grain -= cost.grain ?? 0;
    this.resources.gold -= cost.gold ?? 0;
    return true;
  }

  add(partial: Partial<Resources>): void {
    (Object.keys(partial) as (keyof Resources)[]).forEach((key) => {
      this.resources[key] += partial[key] ?? 0;
    });
  }

  addGold(amount: number): void {
    this.resources.gold += amount;
  }
}
