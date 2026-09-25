import Phaser from 'phaser';
import { isDebugMode } from '../application/debug';
import { saveRepository } from '../application/save';
import { RunTelemetryRecorder } from '../application/telemetry';
import { AudioFeedback } from '../presentation/AudioFeedback';
import { PANEL_X, WORLD_WIDTH, WorldRenderer } from '../presentation/WorldRenderer';
import {
  BUILDINGS,
  FINAL_DAY,
  RESOURCE_LABELS,
  UNITS,
} from '../domain/config';
import { createRun } from '../domain/createRun';
import { GameSimulation } from '../domain/GameSimulation';
import type {
  BuildingKind,
  GameCommand,
  GameEvent,
  ResourceKey,
  RunState,
  UnitKind,
  WorkPriority,
} from '../domain/model';

const PRIORITIES: WorkPriority[] = ['high', 'normal', 'low', 'disabled'];

export class GameScene extends Phaser.Scene {
  private simulation!: GameSimulation;
  private telemetry!: RunTelemetryRecorder;
  private readonly debugMode = isDebugMode();
  private readonly audio = new AudioFeedback(() => saveRepository.loadProfile().settings.masterVolume);
  private worldRenderer!: WorldRenderer;
  private hudText!: Phaser.GameObjects.Text;
  private panelText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private selectedBuilding: BuildingKind | null = null;
  private toastTimer = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    const restored = this.registry.get('runState') as RunState | undefined;
    const state = restored ?? createRun(`TV-${Date.now().toString(36).toUpperCase()}`);
    this.registry.remove('runState');
    this.simulation = new GameSimulation(state);
    this.telemetry = new RunTelemetryRecorder(state);
    saveRepository.saveRun(state);

    this.worldRenderer = new WorldRenderer(this);
    this.hudText = this.add.text(14, 10, '', this.textStyle(16, '#f0dfb0')).setDepth(5);
    this.panelText = this.add.text(PANEL_X + 12, 12, '', this.textStyle(14, '#ded4b9')).setDepth(5);
    this.toastText = this.add.text(WORLD_WIDTH / 2, 670, '', this.textStyle(17, '#ffe5a1'))
      .setOrigin(0.5).setDepth(10);
    this.tutorialText = this.add.text(16, 620, '', {
      ...this.textStyle(15, '#f5e6b6'),
      backgroundColor: '#272118dd',
      padding: { x: 10, y: 8 },
      wordWrap: { width: 620 },
    }).setDepth(8);
    if (this.debugMode) {
      this.debugText = this.add.text(680, 64, '', this.textStyle(13, '#ffd56a')).setDepth(9);
    }

    this.createControls();
    this.createBuildButtons();
    this.createRecruitButtons();
    this.setupInput();
    this.refreshTexts();
  }

  update(_time: number, delta: number): void {
    const realDeltaSec = delta / 1000;
    this.simulation.advance(realDeltaSec);
    this.telemetry.update(realDeltaSec, this.simulation.state);
    const events = this.simulation.drainEvents();
    this.telemetry.recordEvents(events, this.simulation.state);
    this.handleEvents(events);
    this.updateTutorial();
    this.worldRenderer.render(this.simulation.state);
    this.refreshTexts();
    if (this.toastTimer > 0) {
      this.toastTimer -= delta / 1000;
      if (this.toastTimer <= 0) {
        this.toastText.setText('');
      }
    }
  }

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x >= WORLD_WIDTH || this.simulation.state.status !== 'running') {
        return;
      }
      if (pointer.rightButtonDown()) {
        this.dispatch({ type: 'set-rally-point', x: pointer.x, y: pointer.y });
        this.showToast('Точка сбора дружины перенесена');
        return;
      }
      const node = this.simulation.state.exploration.find(
        (candidate) => !candidate.explored && Phaser.Math.Distance.Between(pointer.x, pointer.y, candidate.x, candidate.y) < 28,
      );
      if (node) {
        this.dispatch({ type: 'explore-node', nodeId: node.id });
        return;
      }
      const plot = this.simulation.state.plots.find(
        (candidate) => Phaser.Math.Distance.Between(pointer.x, pointer.y, candidate.x, candidate.y) < 36,
      );
      if (!plot) {
        return;
      }
      if (plot.occupiedBy) {
        this.cyclePriority(plot.occupiedBy);
      } else if (this.selectedBuilding) {
        this.dispatch({
          type: 'place-building', buildingId: this.selectedBuilding, plotId: plot.id,
        });
      } else {
        this.showToast('Сначала выберите здание справа');
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.dispatch({ type: 'set-speed', speed: this.simulation.state.speed === 0 ? 1 : 0 });
    });
    this.input.keyboard?.on('keydown-ONE', () => this.dispatch({ type: 'set-speed', speed: 1 }));
    this.input.keyboard?.on('keydown-TWO', () => this.dispatch({ type: 'set-speed', speed: 2 }));
    if (this.debugMode) {
      this.input.keyboard?.on('keydown-FOUR', () => this.dispatch({ type: 'set-speed', speed: 4 }));
      this.input.keyboard?.on('keydown-EIGHT', () => this.dispatch({ type: 'set-speed', speed: 8 }));
    }
    this.input.keyboard?.on('keydown-Q', () => this.dispatch({ type: 'use-hero-ability' }));
  }

  private createControls(): void {
    const startX = this.debugMode ? 650 : 735;
    this.createButton(startX, 25, 42, 30, 'Ⅱ', () => this.dispatch({ type: 'set-speed', speed: 0 }));
    this.createButton(startX + 48, 25, 42, 30, '1×', () => this.dispatch({ type: 'set-speed', speed: 1 }));
    this.createButton(startX + 96, 25, 42, 30, '2×', () => this.dispatch({ type: 'set-speed', speed: 2 }));
    if (this.debugMode) {
      this.createButton(startX + 144, 25, 42, 30, '4×', () => this.dispatch({ type: 'set-speed', speed: 4 }));
      this.createButton(startX + 192, 25, 42, 30, '8×', () => this.dispatch({ type: 'set-speed', speed: 8 }));
      this.createButton(PANEL_X + 150, 645, 250, 30, 'Экспорт телеметрии', () => this.telemetry.exportJson());
    }
    this.createButton(925, 25, 92, 30, 'Клич [Q]', () => this.dispatch({ type: 'use-hero-ability' }));
    this.createButton(PANEL_X + 150, 690, 250, 34, 'Сохранить и выйти', () => {
      if (this.simulation.state.nightActive) {
        this.showToast('Ночью можно выйти только к последнему рассвету');
        return;
      }
      saveRepository.saveRun(this.simulation.state);
      this.telemetry.checkpoint(this.simulation.state);
      this.scene.start('Menu');
    });
  }

  private createBuildButtons(): void {
    const kinds = Object.keys(BUILDINGS) as BuildingKind[];
    kinds.forEach((kind, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = PANEL_X + 77 + column * 146;
      const y = 178 + row * 43;
      this.createButton(x, y, 136, 34, BUILDINGS[kind].name, () => {
        this.selectedBuilding = this.selectedBuilding === kind ? null : kind;
        this.showToast(this.selectedBuilding ? `Выбрано: ${BUILDINGS[kind].name}` : 'Строительство отменено');
      }, BUILDINGS[kind].color);
    });
  }

  private createRecruitButtons(): void {
    const kinds = Object.keys(UNITS) as UnitKind[];
    kinds.forEach((kind, index) => {
      this.createButton(PANEL_X + 54 + index * 95, 455, 88, 34, UNITS[kind].name, () => {
        this.dispatch({ type: 'recruit-unit', unitId: kind });
      });
    });
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: () => void,
    fillColor = 0x3a5143,
  ): void {
    const hoverColor = this.lightenColor(fillColor, 28);
    const button = this.add.rectangle(x, y, width, height, fillColor)
      .setStrokeStyle(1, 0xb9a978).setInteractive({ useHandCursor: true }).setDepth(6);
    this.add.text(x, y, label, this.textStyle(13, '#f0dfb0')).setOrigin(0.5).setDepth(7);
    button.on('pointerup', action);
    button.on('pointerover', () => button.setFillStyle(hoverColor));
    button.on('pointerout', () => button.setFillStyle(fillColor));
  }

  private lightenColor(color: number, amount: number): number {
    const red = Math.min(255, ((color >> 16) & 0xff) + amount);
    const green = Math.min(255, ((color >> 8) & 0xff) + amount);
    const blue = Math.min(255, (color & 0xff) + amount);
    return (red << 16) | (green << 8) | blue;
  }

  private refreshTexts(): void {
    const state = this.simulation.state;
    const minutes = Math.floor(state.timeOfDay / 60);
    const seconds = Math.floor(state.timeOfDay % 60).toString().padStart(2, '0');
    const resourceLine = (Object.keys(RESOURCE_LABELS) as ResourceKey[])
      .map((key) => `${RESOURCE_LABELS[key]} ${Math.floor(state.resources[key])}`).join('  ·  ');
    this.hudText.setText([
      resourceLine,
      `День ${state.day}/${FINAL_DAY} · ${minutes}:${seconds} · ${state.nightActive ? 'НОЧЬ' : 'ДЕНЬ'} · скорость ${state.speed}×`,
      `Ворота ${Math.ceil(state.gateHp)}/${state.gateMaxHp} · Коловрат ${Math.ceil(state.hero.hp)}/${state.hero.maxHp} · ` +
      `Жители ${state.population.assigned}/${state.population.total} · Дружина ${state.units.length}`,
    ]);

    const selected = this.selectedBuilding ? BUILDINGS[this.selectedBuilding] : null;
    const cost = selected ? this.formatCost(selected.cost) : 'выберите здание';
    if (this.debugText) {
      this.debugText.setText(`DEBUG · ${state.speed}× · враги ${state.enemies.length}/${this.telemetry.data.maxEnemies} · seed ${state.seed}`);
    }

    this.panelText.setText([
      'СТРОИТЕЛЬСТВО',
      selected ? `${selected.name}: ${cost}` : cost,
      selected?.description ?? 'ЛКМ — построить · занятое здание — приоритет',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      'ДРУЖИНА',
      'ПКМ по карте — точка сбора',
      `Клич: ${Math.ceil(state.hero.abilityCooldown)} сек.`,
      '',
      'Участки с золотой точкой усиливают',
      'совпадающее производство на +1.',
    ]);
  }

  private formatCost(cost: Partial<Record<ResourceKey, number>>): string {
    return (Object.entries(cost) as [ResourceKey, number][])
      .map(([key, amount]) => `${RESOURCE_LABELS[key]} ${amount}`).join(', ');
  }

  private cyclePriority(buildingId: string): void {
    const building = this.simulation.state.buildings.find((candidate) => candidate.id === buildingId);
    if (!building || building.status !== 'active' || BUILDINGS[building.kind].jobs === 0) {
      return;
    }
    const current = PRIORITIES.indexOf(building.priority);
    const priority = PRIORITIES[(current + 1) % PRIORITIES.length];
    this.dispatch({ type: 'set-building-priority', buildingId, priority });
    this.showToast(`${BUILDINGS[building.kind].name}: приоритет ${priority}`);
  }

  private dispatch(command: GameCommand): void {
    this.telemetry.recordCommand(command);
    this.simulation.dispatch(command);
  }

  private handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'command-rejected':
          this.showToast(event.reason);
          break;
        case 'building-completed':
          this.audio.play('build');
          this.showToast('Строительство завершено');
          break;
        case 'night-started':
          this.showToast(`Ночь ${event.day}: Навь идёт к воротам`);
          break;
        case 'dawn-started':
          saveRepository.saveRun(this.simulation.state);
          this.showToast(`Рассвет. День ${event.day} сохранён`);
          break;
        case 'hero-ability-used':
          this.audio.play('ability');
          this.showToast('Коловрат поднимает Клич рати!');
          break;
        case 'node-explored':
          this.showToast(`Исследовано: ${event.title}`);
          break;
        case 'run-ended':
          this.audio.play(event.status);
          this.scene.start('Results', { result: event.status, day: this.simulation.state.day });
          break;
        case 'gate-damaged':
          if (this.toastTimer <= 0) {
            this.audio.play('damage');
            this.showToast('Навь бьёт по воротам!');
          }
          break;
        case 'resource-produced':
        case 'enemy-defeated':
        case 'unit-defeated':
          break;
      }
    }
  }

  private updateTutorial(): void {
    const state = this.simulation.state;
    if (!state.buildings.some((building) => building.kind === 'lumber')) {
      this.tutorialText.setText('1/4 Выберите справа «Лесной двор» и поставьте его на свободный участок поселения.');
    } else if (!state.buildings.some((building) => building.kind === 'field')) {
      this.tutorialText.setText('2/4 Постройте поле. Жители сами займут рабочие места; клик по зданию меняет приоритет.');
    } else if (!state.buildings.some((building) => building.kind === 'barracks')) {
      this.tutorialText.setText('3/4 Подготовьте дружинный двор. Для оружия понадобятся рудник и кузница.');
    } else if (state.units.length === 0) {
      this.tutorialText.setText('4/4 Наймите ратника. ПКМ задаёт точку сбора, Q включает Клич рати.');
    } else {
      this.tutorialText.setVisible(false);
    }
  }

  private showToast(message: string): void {
    this.toastText.setText(message);
    this.toastTimer = 3;
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'Tahoma, sans-serif', fontSize: `${size}px`, color };
  }
}
