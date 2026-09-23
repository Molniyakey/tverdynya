import Phaser from 'phaser';
import { saveRepository } from '../application/save';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x202b22);
    this.add.text(width / 2, 185, 'ТВЕРДЫНЯ', {
      fontFamily: 'Georgia, serif', fontSize: '58px', color: '#ead7a7',
    }).setOrigin(0.5);
    this.add.text(width / 2, 245, 'Мифическая Русь · живой град · ночная Навь', {
      fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#c6b994',
    }).setOrigin(0.5);
    this.createButton(width / 2, 340, 'Новый забег', () => this.scene.start('RunSetup'));
    const runSave = saveRepository.loadRun();
    if (runSave) {
      this.createButton(width / 2, 400, 'Продолжить', () => {
        this.registry.set('runState', runSave.state);
        this.scene.start('Game');
      });
    }
    this.createButton(width / 2, runSave ? 460 : 400, 'Летопись', () => {
      this.scene.start('MetaProgression');
    });
    this.createButton(width / 2, runSave ? 520 : 460, 'Настройки', () => {
      this.scene.start('Settings');
    });
  }

  private createButton(x: number, y: number, label: string, action: () => void): void {
    const button = this.add.rectangle(x, y, 250, 46, 0x3f604c)
      .setStrokeStyle(2, 0xe0ca91).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#f0dfad',
    }).setOrigin(0.5);
    button.on('pointerup', action);
    button.on('pointerover', () => button.setFillStyle(0x52775e));
    button.on('pointerout', () => button.setFillStyle(0x3f604c));
  }
}
