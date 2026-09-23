import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/VerticalSliceScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MetaProgressionScene } from './scenes/MetaProgressionScene';
import { ResultsScene } from './scenes/ResultsScene';
import { RunSetupScene } from './scenes/RunSetupScene';
import { SettingsScene } from './scenes/SettingsScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1510',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
  scene: [BootScene, MainMenuScene, RunSetupScene, GameScene, MetaProgressionScene, SettingsScene, ResultsScene],
};

new Phaser.Game(config);