import Phaser from 'phaser';
import { saveRepository } from '../application/save';
import { preloadGameAssets } from '../presentation/AssetCatalog';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    preloadGameAssets(this);
  }

  create(): void {
    this.registry.set('profile', saveRepository.loadProfile());
    this.registry.set('hasRunSave', saveRepository.loadRun() !== null);
    this.scene.start('Menu');
  }
}
