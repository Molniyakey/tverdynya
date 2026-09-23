import Phaser from 'phaser';
import { saveRepository } from '../application/save';
import type { ProfileSave } from '../domain/model';

export class SettingsScene extends Phaser.Scene {
  private profile!: ProfileSave;
  private volumeText!: Phaser.GameObjects.Text;

  constructor() {
    super('Settings');
  }

  create(): void {
    const { width, height } = this.scale;
    this.profile = saveRepository.loadProfile();
    this.add.rectangle(width / 2, height / 2, width, height, 0x1c241e);
    this.add.text(width / 2, 85, 'НАСТРОЙКИ', {
      fontFamily: 'Georgia, serif', fontSize: '38px', color: '#ead7a7',
    }).setOrigin(0.5);
    this.volumeText = this.add.text(width / 2, 210, '', {
      fontFamily: 'Tahoma, sans-serif', fontSize: '20px', color: '#d8cfb6',
    }).setOrigin(0.5);
    this.createButton(width / 2 - 90, 270, '−', () => this.changeVolume(-0.1));
    this.createButton(width / 2 + 90, 270, '+', () => this.changeVolume(0.1));
    this.createButton(width / 2, 350, 'Полный экран', () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
      this.profile.settings.fullscreen = !this.scale.isFullscreen;
      saveRepository.saveProfile(this.profile);
    }, 260);
    this.createButton(width / 2, height - 100, 'Назад', () => this.scene.start('Menu'), 220);
    this.refresh();
  }

  private changeVolume(delta: number): void {
    this.profile.settings.masterVolume = Phaser.Math.Clamp(
      Math.round((this.profile.settings.masterVolume + delta) * 10) / 10,
      0,
      1,
    );
    saveRepository.saveProfile(this.profile);
    this.refresh();
  }

  private refresh(): void {
    this.volumeText.setText(`Громкость: ${Math.round(this.profile.settings.masterVolume * 100)}%`);
  }

  private createButton(x: number, y: number, label: string, action: () => void, width = 70): void {
    const button = this.add.rectangle(x, y, width, 46, 0x405f4c)
      .setStrokeStyle(2, 0xe0ca91).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontFamily: 'Tahoma, sans-serif', fontSize: '18px', color: '#f0dfad',
    }).setOrigin(0.5);
    button.on('pointerup', action);
  }
}
