import Phaser from 'phaser';
import { BUILDINGS, ENEMIES, GATE_POSITION, UNITS } from '../domain/config';
import type { BuildingState, RunState } from '../domain/model';
import { BUILDING_VISUALS } from './AssetCatalog';

export const WORLD_WIDTH = 980;
export const PANEL_X = 980;
const PANEL_WIDTH = 300;
const WORLD_DEPTH_BASE = 1;

interface BuildingView {
  container: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  image?: Phaser.GameObjects.Image;
}

export class WorldRenderer {
  private readonly mapGraphics: Phaser.GameObjects.Graphics;
  private readonly overlayGraphics: Phaser.GameObjects.Graphics;
  private readonly buildingViews = new Map<string, BuildingView>();
  private readonly actorViews = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly residentViews = new Map<string, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {
    this.mapGraphics = scene.add.graphics().setDepth(0);
    this.overlayGraphics = scene.add.graphics().setDepth(3);
  }

  render(state: RunState): void {
    this.drawMap(state);
    this.syncBuildings(state);
    this.syncResidents(state);
    this.syncActors(state);
    this.drawOverlay(state);
  }

  private drawMap(state: RunState): void {
    const graphics = this.mapGraphics;
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
      if (plot.occupiedBy) {
        continue;
      }
      const color = plot.zone === 'defense' ? 0x8d6c49 : 0x78905f;
      graphics.lineStyle(2, color).strokeRect(plot.x - 30, plot.y - 24, 60, 48);
      if (plot.bonus) {
        graphics.fillStyle(0xd8c47d).fillCircle(plot.x + 22, plot.y - 17, 5);
      }
    }
  }

  private syncBuildings(state: RunState): void {
    const activeIds = new Set<string>();
    for (const building of state.buildings) {
      const plot = state.plots.find((candidate) => candidate.id === building.plotId);
      if (!plot) {
        continue;
      }
      activeIds.add(building.id);
      const view = this.getBuildingView(building);
      view.container.setPosition(plot.x, plot.y).setDepth(this.worldDepth(plot.y));
      this.drawBuildingView(view, building);
    }
    for (const [id, view] of this.buildingViews) {
      if (!activeIds.has(id)) {
        view.container.destroy(true);
        this.buildingViews.delete(id);
      }
    }
  }

  private getBuildingView(building: BuildingState): BuildingView {
    const existing = this.buildingViews.get(building.id);
    if (existing) {
      return existing;
    }
    const container = this.scene.add.container(0, 0);
    const graphics = this.scene.add.graphics();
    const visual = BUILDING_VISUALS[building.kind];
    const image = visual && this.scene.textures.exists(visual.textureKey)
      ? this.scene.add.image(0, visual.offsetY, visual.textureKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(visual.width, visual.height)
      : undefined;
    if (image) {
      container.add(image);
    }
    container.add(graphics);
    const view = { container, graphics, image };
    this.buildingViews.set(building.id, view);
    return view;
  }

  private drawBuildingView(view: BuildingView, building: BuildingState): void {
    const definition = BUILDINGS[building.kind];
    const alpha = building.status === 'constructing' ? 0.55 : 1;
    view.graphics.clear();
    view.image?.setAlpha(alpha);
    if (!view.image) {
      view.graphics.fillStyle(definition.color, alpha).fillRect(-27, -21, 54, 42);
      view.graphics.lineStyle(2, building.priority === 'disabled' ? 0x6b6861 : 0xe0cc91)
        .strokeRect(-27, -21, 54, 42);
    }
    if (building.status === 'constructing') {
      const progress = 1 - building.constructionRemaining / definition.buildTime;
      this.drawBar(view.graphics, -24, 26, 48, progress, 0xe1bc58);
    } else if (definition.jobs > 0) {
      for (let index = 0; index < definition.jobs; index += 1) {
        view.graphics.fillStyle(index < building.workersAssigned ? 0xf2d68f : 0x554d42)
          .fillCircle(-7 + index * 14, 29, 4);
      }
    }
  }

  private syncResidents(state: RunState): void {
    const activeIds = new Set<string>();
    let residentIndex = 0;
    for (const building of state.buildings) {
      const plot = state.plots.find((candidate) => candidate.id === building.plotId);
      if (!plot) {
        continue;
      }
      for (let index = 0; index < building.workersAssigned; index += 1) {
        const id = `${building.id}:${index}`;
        activeIds.add(id);
        const angle = state.timeOfDay * 0.55 + residentIndex * 2.2;
        const x = plot.x + Math.cos(angle) * 35;
        const y = plot.y + Math.sin(angle) * 18;
        const view = this.getCircleView(this.residentViews, id);
        view.clear().fillStyle(0xd4b57a).fillCircle(0, 0, 4);
        view.setPosition(x, y).setDepth(this.worldDepth(y, 0.0002));
        residentIndex += 1;
      }
    }
    this.removeMissingGraphics(this.residentViews, activeIds);
  }

  private syncActors(state: RunState): void {
    const activeIds = new Set<string>();
    const heroId = `hero:${state.hero.id}`;
    activeIds.add(heroId);
    const heroView = this.getCircleView(this.actorViews, heroId);
    heroView.clear()
      .fillStyle(state.hero.abilityBuffRemaining > 0 ? 0xffd66b : 0xd29a45).fillCircle(0, 0, 12)
      .lineStyle(2, 0xf3e0a9).strokeCircle(0, 0, 15);
    this.drawBar(heroView, -16, -23, 32, state.hero.hp / state.hero.maxHp, 0xe1b84e);
    heroView.setPosition(state.hero.x, state.hero.y).setDepth(this.worldDepth(state.hero.y, 0.0003));

    for (const unit of state.units) {
      const id = `unit:${unit.id}`;
      activeIds.add(id);
      const view = this.getCircleView(this.actorViews, id);
      view.clear().fillStyle(UNITS[unit.kind].color).fillCircle(0, 0, 8);
      this.drawBar(view, -10, -15, 20, unit.hp / unit.maxHp, 0x78b66a);
      view.setPosition(unit.x, unit.y).setDepth(this.worldDepth(unit.y, 0.0003));
    }

    for (const enemy of state.enemies) {
      const id = `enemy:${enemy.id}`;
      activeIds.add(id);
      const radius = enemy.kind === 'morok' ? 18 : enemy.kind === 'leshyk' ? 12 : 8;
      const view = this.getCircleView(this.actorViews, id);
      view.clear().fillStyle(ENEMIES[enemy.kind].color).fillCircle(0, 0, radius);
      this.drawBar(view, -radius, -radius - 8, radius * 2, enemy.hp / enemy.maxHp, 0xb84e57);
      view.setPosition(enemy.x, enemy.y).setDepth(this.worldDepth(enemy.y, 0.0003));
    }
    this.removeMissingGraphics(this.actorViews, activeIds);
  }

  private drawOverlay(state: RunState): void {
    const graphics = this.overlayGraphics;
    graphics.clear();
    graphics.lineStyle(2, 0xf0cf6a, 0.8).strokeCircle(state.hero.rallyPoint.x, state.hero.rallyPoint.y, 15);
    graphics.lineBetween(state.hero.rallyPoint.x - 7, state.hero.rallyPoint.y, state.hero.rallyPoint.x + 7, state.hero.rallyPoint.y);
    graphics.lineBetween(state.hero.rallyPoint.x, state.hero.rallyPoint.y - 7, state.hero.rallyPoint.x, state.hero.rallyPoint.y + 7);
  }

  private getCircleView(
    collection: Map<string, Phaser.GameObjects.Graphics>,
    id: string,
  ): Phaser.GameObjects.Graphics {
    const existing = collection.get(id);
    if (existing) {
      return existing;
    }
    const view = this.scene.add.graphics();
    collection.set(id, view);
    return view;
  }

  private removeMissingGraphics(
    collection: Map<string, Phaser.GameObjects.Graphics>,
    activeIds: Set<string>,
  ): void {
    for (const [id, view] of collection) {
      if (!activeIds.has(id)) {
        view.destroy();
        collection.delete(id);
      }
    }
  }

  private worldDepth(y: number, offset = 0): number {
    return WORLD_DEPTH_BASE + y / 1000 + offset;
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
}
