import Phaser from 'phaser';
import { HEROES } from '../data/heroes';

export class HeroSelectScene extends Phaser.Scene {
  constructor() {
    super('HeroSelect');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1510);

    this.add
      .text(width / 2, 48, 'Выбор героя', {
        fontFamily: 'Georgia, serif',
        fontSize: '36px',
        color: '#e8d5a3',
      })
      .setOrigin(0.5);

    HEROES.forEach((hero, i) => {
      const x = width / 2 + (i === 0 ? -220 : 220);
      const y = height / 2 + 10;
      const box = this.add
        .rectangle(x, y, 360, 220, 0x2a241c)
        .setStrokeStyle(2, 0xcbb890)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(x, y - 70, hero.name, {
          fontFamily: 'Georgia, serif',
          fontSize: '22px',
          color: '#e8d5a3',
          align: 'center',
          wordWrap: { width: 320 },
        })
        .setOrigin(0.5);

      this.add
        .text(x, y - 30, hero.title, {
          fontFamily: 'Tahoma, sans-serif',
          fontSize: '16px',
          color: '#d4a574',
        })
        .setOrigin(0.5);

      this.add
        .text(x, y + 30, hero.description, {
          fontFamily: 'Tahoma, sans-serif',
          fontSize: '14px',
          color: '#cbb890',
          align: 'center',
          wordWrap: { width: 320 },
        })
        .setOrigin(0.5);

      box.on('pointerover', () => box.setFillStyle(0x3a3228));
      box.on('pointerout', () => box.setFillStyle(0x2a241c));
      box.on('pointerup', () => {
        this.registry.set('heroId', hero.id);
        this.scene.start('Game');
      });
    });
  }
}
