import Phaser from 'phaser';
import { BUILDINGS, getBuilding } from '../data/buildings';
import {
  BUILD_PHASE_SEC,
  CAMERA_PAN_SPEED,
  FIRST_BUILD_PHASE_SEC,
  MAX_CONCURRENT_BUILDS,
  SCOUT_REVEAL_INTERVAL_SEC,
  START_GATE_HP,
  TICK_SEC,
  TILE_SIZE,
  TOWER_UPGRADE_MAX_LEVEL,
  WAVE_CLEAR_BONUS_GOLD,
} from '../data/constants';
import { getHero } from '../data/heroes';
import {
  BOTTOM_BAR_H,
  GAME_HEIGHT,
  GAME_WIDTH,
  LEFT_PANEL_W,
  MAP_COLS,
  MAP_PIXEL_H,
  MAP_PIXEL_W,
  MAP_ROWS,
  OUTSKIRTS_ROW_END,
  OUTSKIRTS_ROW_START,
  TILE_COLORS,
  VIEW_H,
  VIEW_W,
  WALL_ROW,
} from '../data/map';
import { EXPLORE_COST } from '../data/outskirts';
import { getTowerUpgradeCost } from '../data/upgrades';
import { WAVES } from '../data/waves';
import {
  countConstructing,
  createPlacedBuilding,
  getActiveBuffs,
  getCombatStats,
  tryUpgradeTower,
  type PlacedBuilding,
} from '../systems/BuildSystem';
import { Economy } from '../systems/Economy';
import { Grid } from '../systems/Grid';
import {
  formatCostShort,
  OutskirtsSystem,
} from '../systems/OutskirtsSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { ScoutUnit } from '../systems/ScoutUnit';
import { VillageSystem } from '../systems/VillageSystem';
import {
  moveEnemiesSurge,
  retargetFallenOutposts,
  WaveSystem,
  type EnemyInstance,
} from '../systems/WaveSystem';
import type { BuildingDef, GamePhase, HeroDef, Resources } from '../types/game';

const UI_Y = VIEW_H + 8;

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private economy!: Economy;
  private hero!: HeroDef;
  private outskirts!: OutskirtsSystem;
  private villages!: VillageSystem;
  private quests!: QuestSystem;
  private scoutUnit = new ScoutUnit();
  private buildings: PlacedBuilding[] = [];
  private enemies: EnemyInstance[] = [];
  private waves = new WaveSystem();

  private phase: GamePhase = 'build';
  private buildTimer = BUILD_PHASE_SEC;
  private tickTimer = 0;
  private waveIndex = 0;
  private gateHp = START_GATE_HP;
  private toast = '';
  private toastTimer = 0;
  private scoutRevealTimer = SCOUT_REVEAL_INTERVAL_SEC;
  private paused = false;
  private isPanning = false;
  private panLastX = 0;
  private panLastY = 0;

  private selectedBuildingId: string | null = null;

  private worldCam!: Phaser.Cameras.Scene2D.Camera;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyWasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private mapGraphics!: Phaser.GameObjects.Graphics;
  private entityGraphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private buildButtons: Phaser.GameObjects.Rectangle[] = [];
  private buildLabels: Phaser.GameObjects.Text[] = [];
  private worldObjects: Phaser.GameObjects.GameObject[] = [];
  private uiObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    const heroId = (this.registry.get('heroId') as string) || 'kolovrat';
    this.hero = getHero(heroId);
    this.grid = new Grid();
    this.economy = new Economy();
    this.outskirts = new OutskirtsSystem();
    this.villages = new VillageSystem();
    this.quests = new QuestSystem();
    this.scoutUnit = new ScoutUnit();
    this.gateHp = START_GATE_HP + this.hero.gateHpBonus;
    this.tickTimer = TICK_SEC * this.hero.productionIntervalFactor;
    this.buildings = [];
    this.enemies = [];
    this.waveIndex = 0;
    this.phase = 'build';
    this.buildTimer = FIRST_BUILD_PHASE_SEC;
    this.selectedBuildingId = null;
    this.toast = '';
    this.toastTimer = 0;
    this.scoutRevealTimer = SCOUT_REVEAL_INTERVAL_SEC;
    this.paused = false;
    this.isPanning = false;
    this.buildButtons = [];
    this.buildLabels = [];
    this.worldObjects = [];
    this.uiObjects = [];

    this.setupCameras();
    this.setupInput();

    this.mapGraphics = this.add.graphics();
    this.entityGraphics = this.add.graphics().setDepth(5);
    this.trackWorld(this.mapGraphics, this.entityGraphics);

    this.drawMap();
    this.createZoneLabels();
    this.createHud();
    this.createBuildBar();
    this.applyCameraFilters();

    this.worldCam.centerOn(MAP_PIXEL_W / 2, WALL_ROW * TILE_SIZE);
  }

  private setupCameras(): void {
    this.worldCam = this.cameras.main;
    this.worldCam.setViewport(LEFT_PANEL_W, 0, VIEW_W, VIEW_H);
    this.worldCam.setBounds(0, 0, MAP_PIXEL_W, MAP_PIXEL_H);
    this.worldCam.setName('world');

    this.uiCam = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCam.setName('ui');
    this.uiCam.setScroll(0, 0);
    this.uiCam.setZoom(1);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyWasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.keyWasd;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() || (pointer.leftButtonDown() && pointer.event.altKey)) {
        if (pointer.x >= LEFT_PANEL_W && pointer.y < VIEW_H) {
          this.isPanning = true;
          this.panLastX = pointer.x;
          this.panLastY = pointer.y;
        }
        return;
      }

      if (this.paused) return;
      if (pointer.x < LEFT_PANEL_W || pointer.y >= VIEW_H) return;
      if (this.phase === 'victory' || this.phase === 'defeat') return;

      const world = this.worldCam.getWorldPoint(pointer.x, pointer.y);

      if (pointer.rightButtonDown()) {
        this.tryMoveScout(world.x, world.y);
        return;
      }

      if (this.selectedBuildingId) {
        this.tryPlaceBuilding(world.x, world.y);
      } else {
        this.tryOutskirtsAction(world.x, world.y);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonReleased() || pointer.leftButtonReleased()) {
        this.isPanning = false;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isPanning) return;
      const dx = pointer.x - this.panLastX;
      const dy = pointer.y - this.panLastY;
      this.panLastX = pointer.x;
      this.panLastY = pointer.y;
      this.worldCam.scrollX -= dx;
      this.worldCam.scrollY -= dy;
    });

    this.input.mouse?.disableContextMenu();

    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedBuildingId = null;
      this.refreshBuildBar();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.paused) return;
      if (this.phase === 'build') this.startWave();
    });

    this.input.keyboard?.on('keydown-P', () => this.togglePause());

    this.input.keyboard?.on('keydown-C', () => {
      this.worldCam.centerOn(MAP_PIXEL_W / 2, WALL_ROW * TILE_SIZE);
      this.showToast('Камера: стена / ворота');
    });

    this.input.keyboard?.on('keydown-V', () => {
      if (this.scoutUnit.active) {
        this.worldCam.centerOn(this.scoutUnit.x, this.scoutUnit.y);
        this.showToast('Камера: разведчик');
      } else {
        this.showToast('Сначала постройте избу разведчиков');
      }
    });
  }

  private trackWorld(...objs: Phaser.GameObjects.GameObject[]): void {
    this.worldObjects.push(...objs);
  }

  private trackUi(...objs: Phaser.GameObjects.GameObject[]): void {
    this.uiObjects.push(...objs);
  }

  private applyCameraFilters(): void {
    this.uiCam.ignore(this.worldObjects);
    this.worldCam.ignore(this.uiObjects);
  }

  private togglePause(): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.paused = !this.paused;
    this.pauseText.setVisible(this.paused);
    this.showToast(this.paused ? 'Пауза (P — продолжить)' : 'Игра продолжается');
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    if (this.toastTimer > 0) this.toastTimer -= dt;

    this.updateCameraPan(dt);

    if (this.phase === 'victory' || this.phase === 'defeat') {
      this.redrawEntities();
      this.refreshHud();
      return;
    }

    if (this.paused) {
      this.redrawEntities();
      this.refreshHud();
      return;
    }

    this.updateConstruction(dt);
    this.updateEconomy(dt);
    this.updateScoutUnit(dt);
    this.updateScoutReveal(dt);

    if (this.phase === 'build') {
      this.buildTimer -= dt;
      if (this.buildTimer <= 0) this.startWave();
    } else if (this.phase === 'wave') {
      const outposts = this.villages.activeOutposts();
      this.waves.update(dt, this.enemies, outposts);
      retargetFallenOutposts(this.enemies, outposts);
      this.updateCombat(dt);
      moveEnemiesSurge(
        this.enemies,
        dt,
        this.time.now / 1000,
        (enemy) => {
          this.gateHp -= enemy.gateDamage;
          if (this.gateHp <= 0) {
            this.gateHp = 0;
            this.phase = 'defeat';
          }
        },
        (enemy, outpostId) => {
          const v = this.villages.damageOutpost(outpostId, enemy.gateDamage);
          if (v?.destroyed) {
            this.showToast(`Застава «${v.def.name}» пала! Орда прорывается к воротам`);
            retargetFallenOutposts(this.enemies, this.villages.activeOutposts());
          }
        },
      );

      if (this.waves.isWaveCleared(this.enemies)) {
        this.economy.addGold(WAVE_CLEAR_BONUS_GOLD);
        this.enemies = [];
        if (this.waveIndex >= WAVES.length) {
          this.phase = 'victory';
        } else {
          this.phase = 'build';
          this.buildTimer = BUILD_PHASE_SEC;
          this.villages.mendBetweenWaves();
        }
      }
    }

    this.redrawEntities();
    this.refreshHud();
  }

  private updateCameraPan(dt: number): void {
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown || this.keyWasd.A.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.keyWasd.D.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.keyWasd.W.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.keyWasd.S.isDown) vy += 1;
    if (vx === 0 && vy === 0) return;
    const len = Math.hypot(vx, vy) || 1;
    this.worldCam.scrollX += (vx / len) * CAMERA_PAN_SPEED * dt;
    this.worldCam.scrollY += (vy / len) * CAMERA_PAN_SPEED * dt;
  }

  private fogVisible(col: number, row: number): boolean {
    return this.outskirts.isVisible(col, row, this.hasActiveScout(), (c, r) =>
      this.scoutUnit.seesTile(c, r),
    );
  }

  private canScoutWalk(col: number, row: number): boolean {
    if (!this.grid.inBounds(col, row)) return false;
    const tile = this.grid.tiles[row][col];
    if (row >= WALL_ROW) {
      return tile === 'wall' || tile === 'gate' || tile === 'grass' || tile === 'path';
    }
    if (tile !== 'outskirts' && tile !== 'path') return false;
    return this.fogVisible(col, row);
  }

  private updateScoutUnit(dt: number): void {
    if (!this.scoutUnit.active) return;
    this.scoutUnit.update(dt, (c, r) => this.canScoutWalk(c, r));

    let opened = 0;
    for (const { col, row } of this.scoutUnit.tilesInVision()) {
      if (!this.grid.isOutskirtsTile(col, row)) continue;
      if (this.outskirts.isExplored(col, row)) continue;
      this.outskirts.exploreFree(col, row);
      opened += 1;
    }
    if (opened > 0) {
      this.notifyVillageDiscovery();
      this.syncQuests();
    }
  }

  private tryMoveScout(worldX: number, worldY: number): void {
    if (!this.scoutUnit.active) {
      this.showToast('Постройте избу разведчиков, чтобы выслать разведчика');
      return;
    }
    const { col, row } = this.grid.worldToTile(worldX, worldY);
    if (!this.canScoutWalk(col, row) && !this.fogVisible(col, row)) {
      this.showToast('Разведчик не ходит в глухой туман — двигайтесь от края видимости');
      return;
    }
    this.scoutUnit.setTarget(worldX, worldY);
    this.showToast('Разведчик выдвигается (WASD — камера, V — следить)');
  }

  private drawMap(): void {
    this.mapGraphics.clear();
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const kind = this.grid.tiles[row][col];
        const { x, y } = this.grid.tileToWorld(col, row);
        this.mapGraphics.fillStyle(TILE_COLORS[kind], 1);
        this.mapGraphics.fillRect(
          x - TILE_SIZE / 2,
          y - TILE_SIZE / 2,
          TILE_SIZE - 1,
          TILE_SIZE - 1,
        );

        if (kind === 'wall' || kind === 'gate') {
          this.mapGraphics.lineStyle(2, kind === 'gate' ? 0xd4a574 : 0x2a261f, 0.9);
          this.mapGraphics.strokeRect(
            x - TILE_SIZE / 2 + 1,
            y - TILE_SIZE / 2 + 1,
            TILE_SIZE - 3,
            TILE_SIZE - 3,
          );
        }
      }
    }

    this.mapGraphics.lineStyle(3, 0xcbb890, 0.35);
    this.mapGraphics.lineBetween(0, WALL_ROW * TILE_SIZE, MAP_PIXEL_W, WALL_ROW * TILE_SIZE);
    this.mapGraphics.lineStyle(2, 0x7a9a6a, 0.35);
    this.mapGraphics.lineBetween(
      0,
      (OUTSKIRTS_ROW_END + 1) * TILE_SIZE,
      MAP_PIXEL_W,
      (OUTSKIRTS_ROW_END + 1) * TILE_SIZE,
    );
  }

  private createZoneLabels(): void {
    const style = {
      fontFamily: 'Tahoma, sans-serif',
      fontSize: '12px',
      color: '#e8d5a3',
      backgroundColor: '#00000066',
      padding: { x: 6, y: 3 },
    } as const;

    const a = this.add
      .text(MAP_PIXEL_W - 8, 8, 'Округа / Орда', style)
      .setOrigin(1, 0)
      .setDepth(15);
    const b = this.add
      .text(MAP_PIXEL_W - 8, WALL_ROW * TILE_SIZE + 4, 'Стена / ворота', style)
      .setOrigin(1, 0)
      .setDepth(15);
    const c = this.add
      .text(MAP_PIXEL_W - 8, (WALL_ROW + 1) * TILE_SIZE + 6, 'Поселение', style)
      .setOrigin(1, 0)
      .setDepth(15);
    this.trackWorld(a, b, c);
  }

  private createHud(): void {
    this.hudText = this.add
      .text(LEFT_PANEL_W + 10, 8, '', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '13px',
        color: '#f5e6c8',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 6 },
      })
      .setDepth(20);
    this.trackUi(this.hudText);

    this.questText = this.add
      .text(LEFT_PANEL_W + 10, 78, '', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '12px',
        color: '#d4e8c3',
        backgroundColor: '#00000077',
        padding: { x: 8, y: 6 },
      })
      .setDepth(20);
    this.trackUi(this.questText);

    this.hintText = this.add
      .text(LEFT_PANEL_W + 10, UI_Y - 4, '', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '12px',
        color: '#e8d5a3',
        wordWrap: { width: VIEW_W - 20 },
      })
      .setDepth(20);
    this.trackUi(this.hintText);

    this.pauseText = this.add
      .text(GAME_WIDTH / 2, VIEW_H / 2, 'ПАУЗА\nP — продолжить', {
        fontFamily: 'Georgia, serif',
        fontSize: '36px',
        color: '#e8d5a3',
        align: 'center',
        backgroundColor: '#000000cc',
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setVisible(false);
    this.trackUi(this.pauseText);

    const waveBtn = this.add
      .rectangle(GAME_WIDTH - 100, 28, 160, 36, 0x6b3a2a)
      .setStrokeStyle(1, 0xe8d5a3)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    const waveLabel = this.add
      .text(GAME_WIDTH - 100, 28, 'Волна [Пробел]', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '13px',
        color: '#e8d5a3',
      })
      .setOrigin(0.5)
      .setDepth(21);
    waveBtn.on('pointerup', () => {
      if (!this.paused && this.phase === 'build') this.startWave();
    });
    this.trackUi(waveBtn, waveLabel);

    const pauseBtn = this.add
      .rectangle(GAME_WIDTH - 100, 68, 160, 32, 0x3a3a4a)
      .setStrokeStyle(1, 0xcbb890)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    const pauseLabel = this.add
      .text(GAME_WIDTH - 100, 68, 'Пауза [P]', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '13px',
        color: '#e8d5a3',
      })
      .setOrigin(0.5)
      .setDepth(21);
    pauseBtn.on('pointerup', () => this.togglePause());
    this.trackUi(pauseBtn, pauseLabel);

    const camHint = this.add
      .text(GAME_WIDTH - 8, 108, 'WASD / СКМ — карта\nC стена · V разведчик\nПКМ — ход разведчика', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '11px',
        color: '#cbb890',
        align: 'right',
        backgroundColor: '#00000066',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(20);
    this.trackUi(camHint);

    const menuBtn = this.add
      .text(GAME_WIDTH - 8, UI_Y + 8, 'Меню', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '14px',
        color: '#cbb890',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    menuBtn.on('pointerup', () => this.scene.start('Menu'));
    this.trackUi(menuBtn);

    // Нижняя полоса под вьюпортом
    const bottomBar = this.add
      .rectangle(
        LEFT_PANEL_W + VIEW_W / 2,
        VIEW_H + BOTTOM_BAR_H / 2,
        VIEW_W,
        BOTTOM_BAR_H,
        0x14110e,
        1,
      )
      .setDepth(19);
    this.trackUi(bottomBar);
  }

  private createBuildBar(): void {
    const panelBg = this.add
      .rectangle(LEFT_PANEL_W / 2, VIEW_H / 2, LEFT_PANEL_W, VIEW_H, 0x14110e, 1)
      .setDepth(19)
      .setStrokeStyle(2, 0x5a4a3a);
    this.trackUi(panelBg);

    const title = this.add
      .text(LEFT_PANEL_W / 2, 14, 'Постройки', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '13px',
        color: '#e8d5a3',
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.trackUi(title);

    const startY = 32;
    const btnH = 24;
    const gap = 2;

    BUILDINGS.forEach((def, i) => {
      const y = startY + i * (btnH + gap);
      const btn = this.add
        .rectangle(LEFT_PANEL_W / 2, y + btnH / 2, LEFT_PANEL_W - 12, btnH, def.color)
        .setStrokeStyle(1, 0x222222)
        .setInteractive({ useHandCursor: true })
        .setDepth(20);
      const label = this.add
        .text(LEFT_PANEL_W / 2, y + btnH / 2, shortName(def), {
          fontFamily: 'Tahoma, sans-serif',
          fontSize: '11px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(21);

      btn.on('pointerup', () => {
        if (this.paused) return;
        if (this.phase === 'victory' || this.phase === 'defeat') return;
        this.selectedBuildingId =
          this.selectedBuildingId === def.id ? null : def.id;
        this.refreshBuildBar();
        if (this.selectedBuildingId === def.id && !this.economy.canAfford(def.cost)) {
          this.showToast(`${def.name}: не хватает ресурсов (${formatCost(def)}). ${def.help}`);
        }
      });

      this.buildButtons.push(btn);
      this.buildLabels.push(label);
      this.trackUi(btn, label);
    });

    this.descText = this.add
      .text(8, startY + BUILDINGS.length * (btnH + gap) + 8, '', {
        fontFamily: 'Tahoma, sans-serif',
        fontSize: '11px',
        color: '#e8d5a3',
        wordWrap: { width: LEFT_PANEL_W - 16 },
        backgroundColor: '#00000066',
        padding: { x: 4, y: 4 },
      })
      .setDepth(21);
    this.trackUi(this.descText);

    this.refreshBuildBar();
  }

  private refreshBuildBar(): void {
    BUILDINGS.forEach((def, i) => {
      const btn = this.buildButtons[i];
      const selected = this.selectedBuildingId === def.id;
      btn.setStrokeStyle(selected ? 3 : 1, selected ? 0xe8d5a3 : 0x222222);
      btn.setAlpha(this.economy.canAfford(def.cost) ? 1 : 0.4);
    });

    if (this.selectedBuildingId) {
      const def = getBuilding(this.selectedBuildingId);
      this.descText.setText(`${def.name}\n${formatCost(def)}\n${def.help}`);
    } else {
      this.descText.setText(
        'Выберите здание.\nЩит/Кузница/Торг — за золото.\nБашни — на стене.\nWASD — карта.',
      );
    }
  }

  private showToast(message: string): void {
    this.toast = message;
    this.toastTimer = 3;
  }

  private hasActiveScout(): boolean {
    return this.buildings.some(
      (b) => b.def.id === 'scout_hut' && b.status === 'active',
    );
  }

  private ensureScoutSpawned(): void {
    if (this.hasActiveScout() && !this.scoutUnit.active) {
      this.scoutUnit.spawnAtGate();
      this.worldCam.centerOn(this.scoutUnit.x, this.scoutUnit.y);
    }
  }

  private syncQuests(): void {
    this.quests.sync(
      this.outskirts,
      this.hasActiveScout(),
      this.villages.fortifiedCount(),
    );
    const rewarded = this.quests.claimPendingRewards(this.economy);
    if (rewarded.length > 0) {
      this.showToast(`Квест выполнен: ${rewarded.join(', ')}`);
    }
  }

  private notifyVillageDiscovery(): void {
    const newly = this.villages.syncDiscovery((c, r) =>
      this.outskirts.isExplored(c, r),
    );
    for (const v of newly) {
      this.showToast(
        `Найдена деревня «${v.def.name}» — кликните, чтобы укрепить заставу`,
      );
    }
  }

  private updateScoutReveal(dt: number): void {
    if (!this.hasActiveScout()) return;
    if (this.phase === 'victory' || this.phase === 'defeat') return;

    this.scoutRevealTimer -= dt;
    if (this.scoutRevealTimer > 0) return;
    this.scoutRevealTimer = SCOUT_REVEAL_INTERVAL_SEC;

    const candidates: { col: number; row: number }[] = [];
    for (let row = OUTSKIRTS_ROW_START; row <= OUTSKIRTS_ROW_END; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (!this.grid.isOutskirtsTile(col, row)) continue;
        if (this.outskirts.isExplored(col, row)) continue;
        const reachable = this.grid.isOutskirtsReachable(col, row, (c, r) =>
          this.outskirts.isExplored(c, r),
        );
        if (!reachable) continue;
        if (!this.fogVisible(col, row)) continue;
        candidates.push({ col, row });
      }
    }

    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.outskirts.exploreFree(pick.col, pick.row);
    this.notifyVillageDiscovery();
    const found = this.outskirts.getActivityAt(pick.col, pick.row);
    this.showToast(
      found
        ? `Разведчики открыли «${found.def.name}»`
        : 'Разведчики открыли новую клетку округи',
    );
    this.syncQuests();
  }

  private refreshHud(): void {
    const r = this.economy.resources;
    const phaseLabel = this.paused
      ? 'ПАУЗА'
      : this.phase === 'build'
        ? `Стройка ${Math.ceil(this.buildTimer)}с`
        : this.phase === 'wave'
          ? `Набег ${this.waveIndex}/${WAVES.length}`
          : this.phase === 'victory'
            ? 'ПОБЕДА'
            : 'ПОРАЖЕНИЕ';

    this.hudText.setText(
      [
        `${phaseLabel}  |  ${this.hero.name}`,
        `Дер ${r.wood}  Кам ${r.stone}  Зер ${r.grain}  Зол ${r.gold}`,
        `Врата ${this.gateHp}  |  Заставы ${this.villages.fortifiedCount()}/${this.villages.villages.length}  |  Округа: ${this.outskirts.exploredCount()} кл.`,
      ].join('\n'),
    );

    this.questText.setText(['Квесты:', ...this.quests.hudLines()].join('\n'));

    if (this.toastTimer > 0 && this.toast) {
      this.hintText.setText(this.toast);
    } else if (this.phase === 'victory') {
      this.hintText.setText('Орда отбита! Нажмите «Меню».');
    } else if (this.phase === 'defeat') {
      this.hintText.setText('Врата пали. Нажмите «Меню».');
    } else if (this.selectedBuildingId) {
      const def = getBuilding(this.selectedBuildingId);
      const where =
        def.category === 'defense'
          ? 'на стену или слот заставы'
          : def.category === 'siege'
            ? 'на 1-й ряд ЗА стеной (округа у вала)'
            : def.category === 'production'
              ? 'в поселении у ресурса'
              : def.category === 'scout'
                ? 'в поселении — юнит-разведчик и туман'
                : 'в поселении на траве';
      this.hintText.setText(
        `${def.name} (${formatCost(def)}) → ${where}. Esc — отмена.`,
      );
    } else {
      const scoutHint = this.scoutUnit.active
        ? 'ПКМ — разведчик. ЛКМ по башне — апгрейд.'
        : '«Разв.» → разведчик. ЛКМ по башне — апгрейд.';
      this.hintText.setText(
        `WASD — карта. Разведка/деревни/ресурсы (${formatCostShort(EXPLORE_COST)}). ${scoutHint}`,
      );
    }

    this.refreshBuildBar();
  }

  private tryOutskirtsAction(x: number, y: number): void {
    const { col, row } = this.grid.worldToTile(x, y);

    // Апгрейд своей башни
    const tower = this.buildings.find(
      (b) =>
        b.col === col &&
        b.row === row &&
        b.status === 'active' &&
        b.def.upgradable,
    );
    if (tower) {
      this.tryUpgradeBuilding(tower);
      return;
    }

    // Деревня / застава
    const village = this.villages.getAt(col, row);
    if (village && this.fogVisible(col, row)) {
      if (!village.discovered && this.outskirts.isExplored(col, row)) {
        this.notifyVillageDiscovery();
      }
      if (village.discovered && (!village.fortified || village.destroyed)) {
        if (this.villages.fortify(village, this.economy)) {
          this.showToast(
            `Застава «${village.def.name}»: ставьте башни на соседние слоты. Часть волны пойдёт сюда.`,
          );
          this.syncQuests();
        } else if (!this.economy.canAfford(village.def.fortifyCost)) {
          this.showToast(
            `Укрепить «${village.def.name}»: нужно ${this.villages.fortifyCostLabel(village)}`,
          );
        }
        return;
      }
      if (village.fortified && !village.destroyed) {
        this.showToast(
          `Застава «${village.def.name}» HP ${village.hp}/${village.def.maxHp}. Башни — на подсвеченные слоты рядом.`,
        );
        return;
      }
    }

    // Клик по уже открытой пустой клетке / дороге — тоже ведёт разведчика
    if (
      this.scoutUnit.active &&
      this.grid.inBounds(col, row) &&
      !this.outskirts.getActivityAt(col, row) &&
      !this.villages.getAt(col, row)
    ) {
      const exploredOrPath =
        this.outskirts.isExplored(col, row) ||
        this.grid.tiles[row][col] === 'path' ||
        row >= WALL_ROW;
      if (exploredOrPath && this.canScoutWalk(col, row)) {
        this.tryMoveScout(x, y);
        return;
      }
    }

    if (!this.grid.isOutskirtsTile(col, row)) return;

    if (!this.fogVisible(col, row)) {
      this.showToast('Туман войны: изба разведчиков или клетки ближе к стене');
      return;
    }

    const activity = this.outskirts.getActivityAt(col, row);

    if (activity && this.outskirts.isExplored(col, row)) {
      if (activity.claimed) {
        this.showToast(`${activity.def.name}: уже освоено`);
        return;
      }
      if (this.outskirts.claim(activity, this.economy)) {
        this.showToast(`Освоено: ${activity.def.name}`);
        this.syncQuests();
      } else {
        this.showToast(
          `Нужно: ${formatCostShort(activity.def.claimCost)} для «${activity.def.name}»`,
        );
      }
      return;
    }

    const reachable = this.grid.isOutskirtsReachable(col, row, (c, r) =>
      this.outskirts.isExplored(c, r),
    );
    if (!this.outskirts.canExplore(col, row, true, reachable)) {
      this.showToast('Открывайте клетки от стены наружу или ведите разведчика');
      return;
    }

    if (this.outskirts.explore(col, row, this.economy)) {
      this.notifyVillageDiscovery();
      const foundVillage = this.villages.getAt(col, row);
      const found = this.outskirts.getActivityAt(col, row);
      if (foundVillage?.discovered) {
        this.showToast(
          `Деревня «${foundVillage.def.name}» — кликните ещё раз, чтобы укрепить`,
        );
      } else if (found) {
        this.showToast(
          `Разведка: найдено «${found.def.name}» — кликните ещё раз, чтобы освоить`,
        );
      } else {
        this.showToast('Клетка округи открыта');
      }
      this.syncQuests();
    } else {
      this.showToast(`Разведка стоит ${formatCostShort(EXPLORE_COST)}`);
    }
  }

  private tryUpgradeBuilding(b: PlacedBuilding): void {
    const err = tryUpgradeTower(b, this.economy);
    if (err) {
      const cost = getTowerUpgradeCost(b.upgradeLevel);
      this.showToast(
        cost
          ? `${b.def.name} ур.${b.upgradeLevel}: ${err} (${formatCostShort(cost)})`
          : `${b.def.name}: ${err}`,
      );
      return;
    }
    this.showToast(
      `${b.def.name} улучшена до ур.${b.upgradeLevel}/${TOWER_UPGRADE_MAX_LEVEL} (+урон, +дальность)`,
    );
  }

  private tryPlaceBuilding(x: number, y: number): void {
    if (!this.selectedBuildingId) return;
    if (countConstructing(this.buildings) >= MAX_CONCURRENT_BUILDS) {
      this.showToast('Уже строится максимум зданий (2)');
      return;
    }

    const { col, row } = this.grid.worldToTile(x, y);
    const def = getBuilding(this.selectedBuildingId);

    if (!this.economy.canAfford(def.cost)) {
      this.showToast(
        `Мало ресурсов для «${def.name}» (${formatCost(def)}). ${
          def.category === 'unique'
            ? 'Нужно золото: ратуша, completion за стройки, трофеи Орды.'
            : ''
        }`,
      );
      return;
    }

    if (
      !this.grid.canPlace(def, col, row, (c, r) =>
        this.villages.isOutpostTowerSlot(c, r),
      )
    ) {
      if (def.category === 'siege' || def.placement === 'siege_forward') {
        this.showToast(
          `${def.name}: только на 1-й ряд округи сразу за стеной (у вала со стороны Орды).`,
        );
      } else if (def.category === 'defense') {
        this.showToast(
          `${def.name}: стена (серый вал) или слот укреплённой заставы.`,
        );
      } else if (def.category === 'unique' || def.category === 'civic' || def.category === 'scout') {
        this.showToast(
          `${def.name}: только в поселении на траву (снизу), не на стену и не на округу.`,
        );
      } else if (def.category === 'production') {
        this.showToast(`${def.name}: в поселении рядом со своим ресурсом.`);
      } else {
        this.showToast('Здесь нельзя строить');
      }
      return;
    }

    if (def.id === 'town_hall' && this.buildings.some((b) => b.def.id === 'town_hall')) {
      this.showToast('Ратуша уже построена');
      return;
    }
    if (def.id === 'scout_hut' && this.buildings.some((b) => b.def.id === 'scout_hut')) {
      this.showToast('Изба разведчиков уже есть');
      return;
    }
    if (
      def.category === 'unique' &&
      this.buildings.some((b) => b.def.id === def.id)
    ) {
      this.showToast(`${def.name} уже построена (одна на уровень)`);
      return;
    }

    this.economy.pay(def.cost);
    const buffs = getActiveBuffs(this.buildings);
    const placed = createPlacedBuilding(def, col, row, this.hero, buffs.towerHp);
    this.buildings.push(placed);
    this.grid.occupy(col, row, placed.instanceId);
    if (def.id === 'scout_hut') {
      this.showToast('Строим избу разведчиков: появится юнит для хода по округе');
    } else {
      this.showToast(`Строим: ${def.name}`);
    }
  }

  private updateConstruction(dt: number): void {
    for (const b of this.buildings) {
      if (b.status !== 'constructing') continue;
      b.buildProgress += dt / b.def.buildTimeSec;
      if (b.buildProgress >= 1) {
        b.buildProgress = 1;
        b.status = 'active';
        this.economy.addGold(b.def.completionGold);
        if (b.def.id === 'scout_hut') {
          this.ensureScoutSpawned();
          this.showToast('Разведчик у ворот: ПКМ по округе — выслать в туман');
          this.syncQuests();
        }
      }
    }
  }

  private updateEconomy(dt: number): void {
    this.tickTimer -= dt;
    if (this.tickTimer > 0) return;

    this.tickTimer = TICK_SEC * this.hero.productionIntervalFactor;
    const buffs = getActiveBuffs(this.buildings);
    const yieldMul = 1 + this.hero.productionYieldBonus + buffs.productionYield;

    for (const b of this.buildings) {
      if (b.status !== 'active') continue;

      if (b.def.produces) {
        const gained: Partial<Resources> = {};
        for (const key of Object.keys(b.def.produces) as (keyof Resources)[]) {
          const value = b.def.produces[key];
          if (typeof value === 'number') {
            gained[key] = Math.ceil(value * yieldMul);
          }
        }
        this.economy.add(gained);
      }

      if (b.def.taxGoldPerTick) {
        const tax =
          (b.def.taxGoldPerTick + buffs.taxBonus) * (1 + this.hero.taxBonus);
        this.economy.addGold(Math.ceil(tax));
      }
    }

    this.outskirts.produceTick(this.economy, yieldMul);
    this.villages.produceTick(this.economy, yieldMul);
    this.syncQuests();
  }

  private updateCombat(dt: number): void {
    const buffs = getActiveBuffs(this.buildings);
    const dmgMul = 1 + buffs.towerDamage;

    for (const b of this.buildings) {
      if (b.status !== 'active') continue;
      if (b.def.category !== 'defense' && b.def.category !== 'siege') continue;
      const combat = getCombatStats(b);
      if (!combat) continue;

      const pos = this.grid.tileToWorld(b.col, b.row);
      const range = combat.rangeTiles * TILE_SIZE;

      if (combat.slowFactor) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Phaser.Math.Distance.Between(pos.x, pos.y, e.x, e.y) <= range) {
            e.slowFactor = Math.max(e.slowFactor, combat.slowFactor);
          }
        }
        continue;
      }

      b.cooldownLeft -= dt;
      if (b.cooldownLeft > 0) continue;

      const target = this.findTarget(pos.x, pos.y, range);
      if (!target) continue;

      b.cooldownLeft = combat.cooldownSec;
      const damage = combat.damage * dmgMul;

      if (combat.aoeTiles) {
        const aoe = combat.aoeTiles * TILE_SIZE;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Phaser.Math.Distance.Between(target.x, target.y, e.x, e.y) <= aoe) {
            this.damageEnemy(e, damage);
          }
        }
      } else {
        this.damageEnemy(target, damage);
      }
    }
  }

  private findTarget(x: number, y: number, range: number): EnemyInstance | null {
    let best: EnemyInstance | null = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d <= range && d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  private damageEnemy(enemy: EnemyInstance, damage: number): void {
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.economy.addGold(enemy.goldReward);
    }
  }

  private startWave(): void {
    if (this.phase !== 'build') return;
    if (this.waveIndex >= WAVES.length) {
      this.phase = 'victory';
      return;
    }
    const wave = WAVES[this.waveIndex];
    this.waveIndex += 1;
    this.enemies = [];
    this.waves.start(wave, this.villages.activeOutposts());
    this.phase = 'wave';
    const n = this.villages.activeOutposts().length;
    if (n > 0) {
      this.showToast(`Набег: ${n} застав${n === 1 ? 'а' : 'ы'} перехватывают часть Орды`);
    }
  }

  private redrawEntities(): void {
    const g = this.entityGraphics;
    g.clear();

    for (let row = OUTSKIRTS_ROW_START; row <= OUTSKIRTS_ROW_END; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (!this.grid.isOutskirtsTile(col, row) && this.grid.tiles[row][col] !== 'path') {
          continue;
        }
        const { x, y } = this.grid.tileToWorld(col, row);
        const visible = this.fogVisible(col, row);
        const explored = this.outskirts.isExplored(col, row);

        if (!visible) {
          g.fillStyle(0x050708, 0.92);
          g.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE - 1, TILE_SIZE - 1);
          continue;
        }

        if (this.grid.isOutskirtsTile(col, row)) {
          if (!explored) {
            g.fillStyle(0x0d120f, 0.55);
            g.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE - 1, TILE_SIZE - 1);
            const reachable = this.grid.isOutskirtsReachable(col, row, (c, r) =>
              this.outskirts.isExplored(c, r),
            );
            if (reachable) {
              g.lineStyle(2, 0xe8d5a3, 0.45);
              g.strokeRect(
                x - TILE_SIZE / 2 + 2,
                y - TILE_SIZE / 2 + 2,
                TILE_SIZE - 5,
                TILE_SIZE - 5,
              );
            }
          } else {
            g.fillStyle(0x4a6340, 0.35);
            g.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE - 1, TILE_SIZE - 1);
          }
        }
      }
    }

    // Кольцо зрения разведчика
    if (this.scoutUnit.active) {
      g.lineStyle(2, 0x7ec8e3, 0.35);
      g.strokeCircle(
        this.scoutUnit.x,
        this.scoutUnit.y,
        this.scoutUnit.visionTiles * TILE_SIZE,
      );
      g.fillStyle(0x7ec8e3, 1);
      g.fillCircle(this.scoutUnit.x, this.scoutUnit.y, 9);
      g.lineStyle(2, 0xe8f6ff, 1);
      g.strokeCircle(this.scoutUnit.x, this.scoutUnit.y, 9);
    }

    for (const a of this.outskirts.activities) {
      const visible = this.fogVisible(a.def.col, a.def.row);
      if (!visible) continue;
      const { x, y } = this.grid.tileToWorld(a.def.col, a.def.row);
      const explored = this.outskirts.isExplored(a.def.col, a.def.row);
      if (!explored) {
        g.lineStyle(1, 0xcbb890, 0.4);
        g.strokeCircle(x, y, 10);
        continue;
      }
      g.fillStyle(a.def.color, a.claimed ? 1 : 0.55);
      g.fillCircle(x, y, 14);
      g.lineStyle(2, a.claimed ? 0x2ecc71 : 0xe8d5a3, 1);
      g.strokeCircle(x, y, 14);
    }

    // Деревни и слоты застав
    for (const v of this.villages.villages) {
      if (!v.discovered && !this.fogVisible(v.def.col, v.def.row)) continue;
      if (!v.discovered && !this.outskirts.isExplored(v.def.col, v.def.row)) {
        if (this.fogVisible(v.def.col, v.def.row)) {
          const { x, y } = this.grid.tileToWorld(v.def.col, v.def.row);
          g.lineStyle(1, 0xe8d5a3, 0.35);
          g.strokeRect(x - 16, y - 16, 32, 32);
        }
        continue;
      }
      const { x, y } = this.grid.tileToWorld(v.def.col, v.def.row);
      if (v.destroyed) {
        g.fillStyle(0x333333, 0.85);
        g.fillRect(x - 16, y - 16, 32, 32);
        g.lineStyle(2, 0xe74c3c, 0.9);
        g.strokeRect(x - 16, y - 16, 32, 32);
      } else if (v.fortified) {
        g.fillStyle(v.def.color, 1);
        g.fillRect(x - 18, y - 18, 36, 36);
        g.lineStyle(2, 0x2ecc71, 1);
        g.strokeRect(x - 18, y - 18, 36, 36);
        const hpRatio = v.hp / v.def.maxHp;
        g.fillStyle(0x000000, 0.55);
        g.fillRect(x - 18, y - 24, 36, 4);
        g.fillStyle(0xe67e22, 1);
        g.fillRect(x - 18, y - 24, 36 * hpRatio, 4);
        for (const slot of v.def.towerSlots) {
          if (this.grid.isOccupied(slot.col, slot.row)) continue;
          const sp = this.grid.tileToWorld(slot.col, slot.row);
          g.lineStyle(2, 0x7ec8e3, 0.7);
          g.strokeRect(
            sp.x - TILE_SIZE / 2 + 4,
            sp.y - TILE_SIZE / 2 + 4,
            TILE_SIZE - 8,
            TILE_SIZE - 8,
          );
        }
      } else {
        g.fillStyle(v.def.color, 0.75);
        g.fillRect(x - 16, y - 16, 32, 32);
        g.lineStyle(2, 0xf1c40f, 1);
        g.strokeRect(x - 16, y - 16, 32, 32);
      }
    }

    for (const b of this.buildings) {
      const { x, y } = this.grid.tileToWorld(b.col, b.row);
      const alpha = b.status === 'constructing' ? 0.55 : 1;
      g.fillStyle(b.def.color, alpha);
      g.fillRect(x - 18, y - 18, 36, 36);

      if (b.status === 'constructing') {
        g.fillStyle(0x000000, 0.5);
        g.fillRect(x - 18, y + 14, 36, 6);
        g.fillStyle(0xe8d5a3, 1);
        g.fillRect(x - 18, y + 14, 36 * b.buildProgress, 6);
      }

      if (b.upgradeLevel > 0) {
        g.fillStyle(0xf1c40f, 1);
        for (let i = 0; i < b.upgradeLevel; i++) {
          g.fillCircle(x - 12 + i * 8, y - 22, 3);
        }
      }

      const stats = getCombatStats(b);
      if (
        stats &&
        b.status === 'active' &&
        (b.def.category === 'defense' || b.def.category === 'siege')
      ) {
        g.lineStyle(1, b.def.category === 'siege' ? 0xe67e22 : 0xffffff, 0.18);
        g.strokeCircle(x, y, stats.rangeTiles * TILE_SIZE);
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const tile = this.grid.worldToTile(e.x, e.y);
      if (!this.fogVisible(tile.col, tile.row)) continue;
      g.fillStyle(e.color, 1);
      g.fillCircle(e.x, e.y, e.radius);
      if (e.targetKind === 'outpost') {
        g.lineStyle(1, 0xf39c12, 0.8);
        g.strokeCircle(e.x, e.y, e.radius + 3);
      }
      const ratio = e.hp / e.maxHp;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(e.x - 12, e.y - e.radius - 8, 24, 4);
      g.fillStyle(0x2ecc71, 1);
      g.fillRect(e.x - 12, e.y - e.radius - 8, 24 * ratio, 4);
    }

    if (this.selectedBuildingId) {
      const pointer = this.input.activePointer;
      if (pointer.x >= LEFT_PANEL_W && pointer.y < VIEW_H) {
        const world = this.worldCam.getWorldPoint(pointer.x, pointer.y);
        const { col, row } = this.grid.worldToTile(world.x, world.y);
        const def = getBuilding(this.selectedBuildingId);
        const ok =
          this.grid.canPlace(def, col, row, (c, r) =>
            this.villages.isOutpostTowerSlot(c, r),
          ) && this.economy.canAfford(def.cost);
        const { x, y } = this.grid.tileToWorld(col, row);
        g.lineStyle(2, ok ? 0x2ecc71 : 0xe74c3c, 0.9);
        g.strokeRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }
  }
}

function shortName(def: BuildingDef): string {
  const map: Record<string, string> = {
    lumber_camp: 'Лес',
    quarry: 'Камень',
    farm: 'Зерно',
    town_hall: 'Ратуша',
    scout_hut: 'Разв.',
    archer_tower: 'Вышка',
    pitch_cauldron: 'Котёл',
    ward_totem: 'Тотем',
    siege_tower: 'Осада',
    warrior_forge: 'Кузница',
    shield_hall: 'Щит',
    trade_yard: 'Торг',
  };
  return map[def.id] ?? def.name.slice(0, 6);
}

function formatCost(def: BuildingDef): string {
  return formatCostShort(def.cost);
}
