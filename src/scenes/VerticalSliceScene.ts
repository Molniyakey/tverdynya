import Phaser from 'phaser';
import { saveRepository } from '../application/save';
import { AudioFeedback } from '../presentation/AudioFeedback';
import {
  BUILDINGS,
  ENEMIES,
  FINAL_DAY,
  GATE_POSITION,
  RESOURCE_LABELS,
  UNITS,
} from '../domain/config';
import { createRun } from '../domain/createRun';
import { GameSimulation } from '../domain/GameSimulation';
import type {
  BuildingKind,
  BuildingState,
  GameEvent,
  ResourceKey,
  RunState,
  UnitKind,
  WorkPriority,
} from '../domain/model';

const WORLD_WIDTH = 980;
const PANEL_X = 980;
const PANEL_WIDTH = 300;
const PRIORITIES: WorkPriority[] = ['high', 'normal', 'low', 'disabled'];

export class GameScene extends Phaser.Scene {
  private simulation!: GameSimulation;
  private readonly audio = new AudioFeedback(() => saveRepository.loadProfile().settings.masterVolume);
  private graphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private panelText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
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
    saveRepository.saveRun(state);

    this.graphics = this.add.graphics();
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

    this.createControls();
    this.createBuildButtons();
    this.createRecruitButtons();
    this.setupInput();
    this.refreshTexts();
  }

  update(_time: number, delta: number): void {
    this.simulation.advance(delta / 1000);
    this.handleEvents(this.simulation.drainEvents());
    this.updateTutorial();
    this.drawWorld();
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
        this.simulation.dispatch({ type: 'set-rally-point', x: pointer.x, y: pointer.y });
        this.showToast('Точка сбора дружины перенесена');
        return;
      }
      const node = this.simulation.state.exploration.find(
        (candidate) => !candidate.explored && Phaser.Math.Distance.Between(pointer.x, pointer.y, candidate.x, candidate.y) < 28,
      );
      if (node) {
        this.simulation.dispatch({ type: 'explore-node', nodeId: node.id });
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
        this.simulation.dispatch({
          type: 'place-building', buildingId: this.selectedBuilding, plotId: plot.id,
        });
      } else {
        this.showToast('Сначала выберите здание справа');
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.simulation.dispatch({ type: 'set-speed', speed: this.simulation.state.speed === 0 ? 1 : 0 });
    });
    this.input.keyboard?.on('keydown-ONE', () => this.simulation.dispatch({ type: 'set-speed', speed: 1 }));
    this.input.keyboard?.on('keydown-TWO', () => this.simulation.dispatch({ type: 'set-speed', speed: 2 }));
    this.input.keyboard?.on('keydown-Q', () => this.simulation.dispatch({ type: 'use-hero-ability' }));
  }

  private createControls(): void {
    this.createButton(735, 25, 42, 30, 'Ⅱ', () => this.simulation.dispatch({ type: 'set-speed', speed: 0 }));
    this.createButton(783, 25, 42, 30, '1×', () => this.simulation.dispatch({ type: 'set-speed', speed: 1 }));
    this.createButton(831, 25, 42, 30, '2×', () => this.simulation.dispatch({ type: 'set-speed', speed: 2 }));
    this.createButton(901, 25, 84, 30, 'Клич [Q]', () => this.simulation.dispatch({ type: 'use-hero-ability' }));
    this.createButton(PANEL_X + 150, 690, 250, 34, 'Сохранить и выйти', () => {
      if (this.simulation.state.nightActive) {
        this.showToast('Ночью можно выйти только к последнему рассвету');
        return;
      }
      saveRepository.saveRun(this.simulation.state);
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
      });
    });
  }

  private createRecruitButtons(): void {
    const kinds = Object.keys(UNITS) as UnitKind[];
    kinds.forEach((kind, index) => {
      this.createButton(PANEL_X + 54 + index * 95, 455, 88, 34, UNITS[kind].name, () => {
        this.simulation.dispatch({ type: 'recruit-unit', unitId: kind });
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
  ): void {
    const button = this.add.rectangle(x, y, width, height, 0x3a5143)
      .setStrokeStyle(1, 0xb9a978).setInteractive({ useHandCursor: true }).setDepth(6);
    this.add.text(x, y, label, this.textStyle(13, '#f0dfb0')).setOrigin(0.5).setDepth(7);
    button.on('pointerup', action);
    button.on('pointerover', () => button.setFillStyle(0x52745d));
    button.on('pointerout', () => button.setFillStyle(0x3a5143));
  }

  private drawWorld(): void {
    const state = this.simulation.state;
    const graphics = this.graphics;
    graphics.clear();

    graphics.fillStyle(state.nightActive ? 0x182030 : 0x304b35).fillRect(0, 0, WORLD_WIDTH, 720);
    graphics.fillStyle(state.nightActive ? 0x21293b : 0x3f6748).fillRect(0, 55, WORLD_WIDTH, 190);
    graphics.fillStyle(0x5c614b).fillRect(0, 245, WORLD_WIDTH, 210);
    graphics.fillStyle(0x526a43).fillRect(0, 455, WORLD_WIDTH, 265);
    graphics.fillStyle(0x302a24).fillRect(PANEL_X, 0, PANEL_WIDTH, 720);

    graphics.lineStyle(8, 0x6c4b34).lineBetween(75, 450, 905, 450);
    graphics.fillStyle(0x49372a).fillRect(GATE_POSITION.x - 30, 430, 60, 45);
    this.drawBar(graphics, GATE_POSITION.x - 38, 418, 76, state.gateHp / state.gateMaxHp, 0xc05a48);

    for (const node of state.exploration) {
      graphics.fillStyle(node.explored ? 0x3f493f : 0xb79b55).fillCircle(node.x, node.y, node.explored ? 11 : 18);
      if (!node.explored) {
        graphics.lineStyle(2, 0xf0d591).strokeCircle(node.x, node.y, 23);
      }
    }

    for (const plot of state.plots) {
      const building = plot.occupiedBy
        ? state.buildings.find((candidate) => candidate.id === plot.occupiedBy)
        : undefined;
      if (!building) {
        const color = plot.zone === 'defense' ? 0x8d6c49 : 0x78905f;
        graphics.lineStyle(2, color).strokeRect(plot.x - 30, plot.y - 24, 60, 48);
        if (plot.bonus) {
          graphics.fillStyle(0xd8c47d).fillCircle(plot.x + 22, plot.y - 17, 5);
        }
        continue;
      }
      this.drawBuilding(graphics, building, plot.x, plot.y);
    }

    this.drawResidents(graphics);
    this.drawHero(graphics);
    for (const unit of state.units) {
      const definition = UNITS[unit.kind];
      graphics.fillStyle(definition.color).fillCircle(unit.x, unit.y, 8);
      this.drawBar(graphics, unit.x - 10, unit.y - 15, 20, unit.hp / unit.maxHp, 0x78b66a);
    }
    for (const enemy of state.enemies) {
      const definition = ENEMIES[enemy.kind];
      const radius = enemy.kind === 'morok' ? 18 : enemy.kind === 'leshyk' ? 12 : 8;
      graphics.fillStyle(definition.color).fillCircle(enemy.x, enemy.y, radius);
      this.drawBar(graphics, enemy.x - radius, enemy.y - radius - 8, radius * 2, enemy.hp / enemy.maxHp, 0xb84e57);
    }

    graphics.lineStyle(2, 0xf0cf6a, 0.8).strokeCircle(state.hero.rallyPoint.x, state.hero.rallyPoint.y, 15);
    graphics.lineBetween(state.hero.rallyPoint.x - 7, state.hero.rallyPoint.y, state.hero.rallyPoint.x + 7, state.hero.rallyPoint.y);
    graphics.lineBetween(state.hero.rallyPoint.x, state.hero.rallyPoint.y - 7, state.hero.rallyPoint.x, state.hero.rallyPoint.y + 7);
  }

  private drawBuilding(
    graphics: Phaser.GameObjects.Graphics,
    building: BuildingState,
    x: number,
    y: number,
  ): void {
    const definition = BUILDINGS[building.kind];
    graphics.fillStyle(definition.color, building.status === 'constructing' ? 0.55 : 1)
      .fillRect(x - 27, y - 21, 54, 42);
    graphics.lineStyle(2, building.priority === 'disabled' ? 0x6b6861 : 0xe0cc91)
      .strokeRect(x - 27, y - 21, 54, 42);
    if (building.status === 'constructing') {
      const progress = 1 - building.constructionRemaining / definition.buildTime;
      this.drawBar(graphics, x - 24, y + 26, 48, progress, 0xe1bc58);
    } else if (definition.jobs > 0) {
      for (let index = 0; index < definition.jobs; index += 1) {
        graphics.fillStyle(index < building.workersAssigned ? 0xf2d68f : 0x554d42)
          .fillCircle(x - 7 + index * 14, y + 29, 4);
      }
    }
  }

  private drawResidents(graphics: Phaser.GameObjects.Graphics): void {
    const state = this.simulation.state;
    let residentIndex = 0;
    for (const building of state.buildings) {
      if (building.workersAssigned <= 0) {
        continue;
      }
      const plot = state.plots.find((candidate) => candidate.id === building.plotId);
      if (!plot) {
        continue;
      }
      for (let index = 0; index < building.workersAssigned; index += 1) {
        const angle = state.timeOfDay * 0.55 + residentIndex * 2.2;
        graphics.fillStyle(0xd4b57a).fillCircle(
          plot.x + Math.cos(angle) * 35,
          plot.y + Math.sin(angle) * 18,
          4,
        );
        residentIndex += 1;
      }
    }
  }

  private drawHero(graphics: Phaser.GameObjects.Graphics): void {
    const hero = this.simulation.state.hero;
    graphics.fillStyle(hero.abilityBuffRemaining > 0 ? 0xffd66b : 0xd29a45).fillCircle(hero.x, hero.y, 12);
    graphics.lineStyle(2, 0xf3e0a9).strokeCircle(hero.x, hero.y, 15);
    this.drawBar(graphics, hero.x - 16, hero.y - 23, 32, hero.hp / hero.maxHp, 0xe1b84e);
  }

  private drawBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    ratio: number,
    color: number,
  ): void {
    graphics.fillStyle(0x211d1a).fillRect(x, y, width, 4);
    graphics.fillStyle(color).fillRect(x, y, Math.max(0, width * Phaser.Math.Clamp(ratio, 0, 1)), 4);
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
    this.simulation.dispatch({ type: 'set-building-priority', buildingId, priority });
    this.showToast(`${BUILDINGS[building.kind].name}: приоритет ${priority}`);
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
