import Phaser from 'phaser';
import { createRun } from '../domain/createRun';

export class RunSetupScene extends Phaser.Scene {
  constructor() {
    super('RunSetup');
  }

  create(): void {
    const { width, height } = this.scale;
    const seed = `TV-${Date.now().toString(36).toUpperCase()}`;
    this.add.rectangle(width / 2, height / 2, width, height, 0x171c18);
    this.add.text(width / 2, 70, 'ПЕРВАЯ ТВЕРДЫНЯ', {
      fontFamily: 'Georgia, serif', fontSize: '38px', color: '#ead7a7',
    }).setOrigin(0.5);
    this.add.text(width / 2, 132, 'Коловрат · Воевода рубежа', {
      fontFamily: 'Georgia, serif', fontSize: '24px', color: '#d6a85f',
    }).setOrigin(0.5);
    this.add.text(width / 2, 215,
      'Поднимите град за пять дней. Ночью Навь придёт к воротам.\n' +
      'Клич рати усиливает Коловрата и дружину на 15 секунд.', {
        fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#c9c2ae',
        align: 'center', lineSpacing: 8,
      }).setOrigin(0.5);
    this.add.text(width / 2, 300, `Семя мира: ${seed}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#8ca493',
    }).setOrigin(0.5);
    this.createButton(width / 2, 390, 'Начать летопись', () => {
      this.registry.set('runState', createRun(seed));
      this.scene.start('Game');
    });
    this.createButton(width / 2, 455, 'Назад', () => this.scene.start('Menu'));
  }

  private createButton(x: number, y: number, label: string, action: () => void): void {
    const button = this.add.rectangle(x, y, 270, 48, 0x425d4a)
      .setStrokeStyle(2, 0xdbc48c).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#f1dfae',
    }).setOrigin(0.5);
    button.on('pointerup', action);
    button.on('pointerover', () => button.setFillStyle(0x52745c));
    button.on('pointerout', () => button.setFillStyle(0x425d4a));
  }
}
