import Phaser from 'phaser';
import { applyRunResult, saveRepository } from '../application/save';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: { result?: 'victory' | 'defeat'; day?: number }): void {
    const { width, height } = this.scale;
    const result = data.result ?? 'defeat';
    saveRepository.saveProfile(applyRunResult(saveRepository.loadProfile(), result));
    saveRepository.clearRun();
    this.add.rectangle(width / 2, height / 2, width, height, result === 'victory' ? 0x263a2d : 0x352323);
    this.add.text(width / 2, 150, result === 'victory' ? 'РАССВЕТ НАД ТВЕРДЫНЕЙ' : 'ТВЕРДЫНЯ ПАЛА', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#ecd9a5',
    }).setOrigin(0.5);
    this.add.text(width / 2, 235,
      result === 'victory'
        ? 'Морок отступил. Открыта реликвия «Уголёк рассвета».'
        : `Град продержался до дня ${data.day ?? 1}. Падение записано в летописи.`, {
        fontFamily: 'Tahoma, sans-serif', fontSize: '19px', color: '#d0c7ae',
        align: 'center', wordWrap: { width: 720 },
      }).setOrigin(0.5);
    const button = this.add.rectangle(width / 2, 360, 260, 48, 0x405f4c)
      .setStrokeStyle(2, 0xe0ca91).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, 360, 'Вернуться в меню', {
      fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#f0dfad',
    }).setOrigin(0.5);
    button.on('pointerup', () => this.scene.start('Menu'));
  }
}
