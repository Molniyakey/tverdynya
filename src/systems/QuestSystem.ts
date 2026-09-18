import { QUESTS, type QuestDef } from '../data/outskirts';
import type { Economy } from './Economy';
import type { OutskirtsSystem } from './OutskirtsSystem';

export interface QuestRuntime {
  def: QuestDef;
  progress: number;
  completed: boolean;
  claimedReward: boolean;
}

export class QuestSystem {
  quests: QuestRuntime[];

  constructor() {
    this.quests = QUESTS.map((def) => ({
      def,
      progress: 0,
      completed: false,
      claimedReward: false,
    }));
  }

  sync(outskirts: OutskirtsSystem, hasScout = false, fortifiedVillages = 0): void {
    for (const q of this.quests) {
      if (q.completed) continue;
      switch (q.def.type) {
        case 'explore_tiles':
          q.progress = outskirts.exploredCount();
          break;
        case 'claim_activity':
          q.progress = outskirts.activities.some(
            (a) => a.def.id === q.def.activityId && a.claimed,
          )
            ? 1
            : 0;
          break;
        case 'outskirts_gold':
          q.progress = outskirts.goldEarnedFromOutskirts;
          break;
        case 'build_scout':
          q.progress = hasScout ? 1 : 0;
          break;
        case 'fortify_village':
          q.progress = fortifiedVillages;
          break;
      }
      if (q.progress >= q.def.target) {
        q.completed = true;
      }
    }
  }

  claimPendingRewards(economy: Economy): string[] {
    const titles: string[] = [];
    for (const q of this.quests) {
      if (q.completed && !q.claimedReward) {
        economy.add(q.def.reward);
        q.claimedReward = true;
        titles.push(q.def.title);
      }
    }
    return titles;
  }

  hudLines(): string[] {
    return this.quests.map((q) => {
      const mark = q.claimedReward ? '✓' : q.completed ? '!' : '·';
      return `${mark} ${q.def.title} (${Math.min(q.progress, q.def.target)}/${q.def.target})`;
    });
  }
}
