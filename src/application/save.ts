import { RUN_VERSION } from '../domain/config';
import type { ProfileSave, RunSave, RunState } from '../domain/model';

const PROFILE_KEY = 'tverdynya.profile.v1';
const RUN_KEY = 'tverdynya.run.v1';
export const PROFILE_VERSION = 1;

export interface SaveRepository {
  loadProfile(): ProfileSave;
  saveProfile(profile: ProfileSave): void;
  loadRun(): RunSave | null;
  saveRun(state: RunState): void;
  clearRun(): void;
}

export function createDefaultProfile(): ProfileSave {
  return {
    version: PROFILE_VERSION,
    unlockedHeroIds: ['kolovrat'],
    unlockedBuildingIds: [
      'house', 'lumber', 'quarry', 'field', 'cookhouse',
      'mine', 'smithy', 'barracks', 'tower', 'ward',
    ],
    unlockedRelicIds: [],
    storyFlags: ['chronicle-begins'],
    settings: { masterVolume: 0.8, fullscreen: false },
  };
}

function isProfileSave(value: unknown): value is ProfileSave {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ProfileSave>;
  return candidate.version === PROFILE_VERSION
    && Array.isArray(candidate.unlockedHeroIds)
    && Array.isArray(candidate.unlockedBuildingIds)
    && Array.isArray(candidate.unlockedRelicIds)
    && Array.isArray(candidate.storyFlags)
    && typeof candidate.settings?.masterVolume === 'number';
}

function isRunSave(value: unknown): value is RunSave {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<RunSave>;
  return candidate.version === RUN_VERSION
    && typeof candidate.savedAt === 'string'
    && candidate.state?.version === RUN_VERSION
    && candidate.state.status === 'running'
    && typeof candidate.state.seed === 'string'
    && Array.isArray(candidate.state.buildings)
    && Array.isArray(candidate.state.units)
    && Array.isArray(candidate.state.enemies);
}

export class LocalStorageSaveRepository implements SaveRepository {
  loadProfile(): ProfileSave {
    const loaded = this.read(PROFILE_KEY);
    return isProfileSave(loaded) ? loaded : createDefaultProfile();
  }

  saveProfile(profile: ProfileSave): void {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  loadRun(): RunSave | null {
    const loaded = this.read(RUN_KEY);
    if (!isRunSave(loaded)) {
      if (loaded !== null) {
        this.clearRun();
      }
      return null;
    }
    return loaded;
  }

  saveRun(state: RunState): void {
    const save: RunSave = {
      version: RUN_VERSION,
      savedAt: new Date().toISOString(),
      state,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(save));
  }

  clearRun(): void {
    localStorage.removeItem(RUN_KEY);
  }

  private read(key: string): unknown {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }
}

export function applyRunResult(profile: ProfileSave, result: 'victory' | 'defeat'): ProfileSave {
  const next: ProfileSave = JSON.parse(JSON.stringify(profile)) as ProfileSave;
  const storyFlag = result === 'victory' ? 'morok-defeated' : 'first-fall';
  if (!next.storyFlags.includes(storyFlag)) {
    next.storyFlags.push(storyFlag);
  }
  if (result === 'victory' && !next.unlockedRelicIds.includes('ember-of-dawn')) {
    next.unlockedRelicIds.push('ember-of-dawn');
  }
  return next;
}

export const saveRepository: SaveRepository = new LocalStorageSaveRepository();
