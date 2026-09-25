import Phaser from 'phaser';
import { applyRunResult, saveRepository } from '../application/save';
import { loadTelemetry } from '../application/telemetry';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: { result?: 'victory' | 'defeat'; day?: number }): void {
    const { width, height } = this.scale;
    const result = data.result ?? 'defeat';
    const telemetry = loadTelemetry()[0];
    saveRepository.saveProfile(applyRunResult(saveRepository.loadProfile(), result));
    saveRepository.clearRun();

    this.add.rectangle(width / 2, height / 2, width, height, result === 'victory' ? 0x263a2d : 0x352323);
    this.add.text(width / 2, 125, result === 'victory' ? 'РАССВЕТ НАД ТВЕРДЫНЕЙ' : 'ТВЕРДЫНЯ ПАЛА', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#ecd9a5',
    }).setOrigin(0.5);
    this.add.text(width / 2, 200,
      result === 'victory'
        ? 'Морок отступил. Открыта реликвия «Уголёк рассвета».'
        : `Град продержался до дня ${data.day ?? 1}. Падение записано в летописи.`, {
        fontFamily: 'Tahoma, sans-serif', fontSize: '19px', color: '#d0c7ae',
        align: 'center', wordWrap: { width: 720 },
      }).setOrigin(0.5);

    if (telemetry?.result === result) {
      const minutes = Math.floor(telemetry.gameDurationSec / 60);
      const seconds = Math.floor(telemetry.gameDurationSec % 60).toString().padStart(2, '0');
      const firstBuilding = telemetry.firstBuildingAtSec === null ? '—' : `${Math.round(telemetry.firstBuildingAtSec)} с`;
      const firstUnit = telemetry.firstUnitAtSec === null ? '—' : `${Math.round(telemetry.firstUnitAtSec)} с`;
      this.add.text(width / 2, 285, [
        `Время забега: ${minutes}:${seconds}   Врагов побеждено: ${telemetry.enemiesDefeated}`,
        `Потери дружины: ${telemetry.unitsLost}   Урон воротам: ${Math.round(telemetry.gateDamageTaken)}`,
        `Первое здание: ${firstBuilding}   Первый боец: ${firstUnit}`,
        `Максимум врагов: ${telemetry.maxEnemies}   Максимум дружины: ${telemetry.maxUnits}`,
      ].join('\n'), {
        fontFamily: 'Tahoma, sans-serif', fontSize: '17px', color: '#eee1bd',
        align: 'center', lineSpacing: 7,
      }).setOrigin(0.5);
    }

    const button = this.add.rectangle(width / 2, 430, 260, 48, 0x405f4c)
      .setStrokeStyle(2, 0xe0ca91).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, 430, 'Вернуться в меню', {
      fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#f0dfad',
    }).setOrigin(0.5);
    button.on('pointerup', () => this.scene.start('Menu'));
  }
}
