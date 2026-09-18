import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x24301f);

    this.add
      .text(width / 2, height / 2 - 70, 'ТВЕРДЫНЯ', {
        fontFamily: 'Georgia, serif',
        fontSize: '48px',
        color: '#e8d5a3',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 10, 'Серый прототип · защита поселения от Орды', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '16px',
        color: '#cbb890',
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(width / 2, height / 2 + 70, 220, 48, 0x3d5a80)
      .setStrokeStyle(2, 0xe8d5a3)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(width / 2, height / 2 + 70, 'Играть', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '20px',
        color: '#e8d5a3',
      })
      .setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x4a6fa5));
    btn.on('pointerout', () => btn.setFillStyle(0x3d5a80));
    btn.on('pointerup', () => this.scene.start('HeroSelect'));
  }
}
