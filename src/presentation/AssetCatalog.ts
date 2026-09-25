import Phaser from 'phaser';
import type { BuildingKind } from '../domain/model';

export interface BuildingVisualDefinition {
  textureKey: string;
  url: string;
  width: number;
  height: number;
  offsetY: number;
}

export const BUILDING_VISUALS: Partial<Record<BuildingKind, BuildingVisualDefinition>> = {
  house: {
    textureKey: 'building-house',
    url: 'assets/buildings/house.png',
    width: 128,
    height: 128,
    offsetY: 25,
  },
};

export function preloadGameAssets(scene: Phaser.Scene): void {
  for (const visual of Object.values(BUILDING_VISUALS)) {
    if (visual && !scene.textures.exists(visual.textureKey)) {
      scene.load.image(visual.textureKey, visual.url);
    }
  }
}
