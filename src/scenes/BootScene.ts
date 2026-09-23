import Phaser from 'phaser';
import { saveRepository } from '../application/save';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.registry.set('profile', saveRepository.loadProfile());
    this.registry.set('hasRunSave', saveRepository.loadRun() !== null);
    this.scene.start('Menu');
  }
}
