import Phaser from 'phaser';
import { saveRepository } from '../application/save';

export class MetaProgressionScene extends Phaser.Scene {
  constructor() {
    super('MetaProgression');
  }

  create(): void {
    const { width, height } = this.scale;
    const profile = saveRepository.loadProfile();
    this.add.rectangle(width / 2, height / 2, width, height, 0x181c19);
    this.add.text(width / 2, 55, 'ЛЕТОПИСЬ', {
      fontFamily: 'Georgia, serif', fontSize: '38px', color: '#ead7a7',
    }).setOrigin(0.5);
    const lines = [
      `Герои: ${profile.unlockedHeroIds.join(', ') || '—'}`,
      `Открыто зданий: ${profile.unlockedBuildingIds.length}`,
      `Реликвии: ${profile.unlockedRelicIds.join(', ') || 'пока нет'}`,
      '', 'Записи:', ...profile.storyFlags.map((flag) => `• ${this.storyLabel(flag)}`),
    ];
    this.add.text(170, 130, lines.join('\n'), {
      fontFamily: 'Tahoma, sans-serif', fontSize: '19px', color: '#cfc7b2',
      lineSpacing: 10, wordWrap: { width: width - 340 },
    });
    const back = this.add.rectangle(width / 2, height - 65, 220, 44, 0x3d5a4d)
      .setStrokeStyle(2, 0xd8c58f).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height - 65, 'Назад', {
      fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#ead7a7',
    }).setOrigin(0.5);
    back.on('pointerup', () => this.scene.start('Menu'));
  }

  private storyLabel(flag: string): string {
    const labels: Record<string, string> = {
      'chronicle-begins': 'На рубеже заложена первая Твердыня.',
      'first-fall': 'Летописец записал первое падение града.',
      'morok-defeated': 'Морок рассеян над древними воротами.',
    };
    return labels[flag] ?? flag;
  }
}
