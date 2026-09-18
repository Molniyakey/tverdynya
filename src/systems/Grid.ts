import {
  MAP_COLS,
  MAP_ROWS,
  WALL_ROW,
  createTileGrid,
  tileToWorld,
  worldToTile,
  buildPathWaypoints,
  isSettlementRow,
  isOutskirtsRow,
} from '../data/map';
import { SIEGE_FORWARD_ROW_OFFSET } from '../data/constants';
import type { BuildingDef, NeedsNode, PlacementRule, TileKind } from '../types/game';

export class Grid {
  readonly tiles: TileKind[][];
  readonly occupied: (string | null)[][];
  readonly waypoints: { x: number; y: number }[];

  constructor() {
    this.tiles = createTileGrid();
    this.occupied = Array.from({ length: MAP_ROWS }, () =>
      Array.from({ length: MAP_COLS }, () => null),
    );
    this.waypoints = buildPathWaypoints(this.tiles);
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < MAP_COLS && row < MAP_ROWS;
  }

  getTile(col: number, row: number): TileKind | null {
    if (!this.inBounds(col, row)) return null;
    return this.tiles[row][col];
  }

  isOccupied(col: number, row: number): boolean {
    return this.occupied[row][col] !== null;
  }

  occupy(col: number, row: number, buildingId: string): void {
    this.occupied[row][col] = buildingId;
  }

  neighbors(col: number, row: number): { col: number; row: number }[] {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    return dirs
      .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
      .filter((p) => this.inBounds(p.col, p.row));
  }

  hasAdjacentNode(col: number, row: number, node: NeedsNode): boolean {
    if (!node) return true;
    const kind = node as TileKind;
    return this.neighbors(col, row).some((n) => this.tiles[n.row][n.col] === kind);
  }

  isSettlementPlot(col: number, row: number): boolean {
    if (!isSettlementRow(row)) return false;
    return this.tiles[row][col] === 'grass';
  }

  isWallDefenseSlot(col: number, row: number): boolean {
    return this.tiles[row][col] === 'wall';
  }

  isOutskirtsTile(col: number, row: number): boolean {
    return this.inBounds(col, row) && this.tiles[row][col] === 'outskirts';
  }

  /** Первый ряд за стеной со стороны Орды */
  isSiegeForwardSlot(col: number, row: number): boolean {
    if (row !== WALL_ROW - SIEGE_FORWARD_ROW_OFFSET) return false;
    const tile = this.tiles[row][col];
    return tile === 'outskirts' || tile === 'path';
  }

  isOutskirtsReachable(
    col: number,
    row: number,
    isExplored: (c: number, r: number) => boolean,
  ): boolean {
    return this.neighbors(col, row).some((n) => {
      const tile = this.tiles[n.row][n.col];
      if (n.row === WALL_ROW && (tile === 'wall' || tile === 'gate')) {
        return true;
      }
      if (isOutskirtsRow(n.row) && isExplored(n.col, n.row)) {
        return true;
      }
      if (tile === 'path' && isOutskirtsRow(n.row)) {
        return true;
      }
      return false;
    });
  }

  placementRule(def: BuildingDef): PlacementRule {
    if (def.placement) return def.placement;
    if (def.category === 'defense') return 'wall';
    if (def.category === 'siege') return 'siege_forward';
    return 'settlement';
  }

  canPlace(
    def: BuildingDef,
    col: number,
    row: number,
    isOutpostSlot: (c: number, r: number) => boolean = () => false,
  ): boolean {
    if (!this.inBounds(col, row)) return false;
    if (this.isOccupied(col, row)) return false;

    const rule = this.placementRule(def);

    if (rule === 'wall') {
      return this.isWallDefenseSlot(col, row);
    }
    if (rule === 'wall_or_outpost') {
      return this.isWallDefenseSlot(col, row) || isOutpostSlot(col, row);
    }
    if (rule === 'siege_forward') {
      return this.isSiegeForwardSlot(col, row);
    }

    if (!this.isSettlementPlot(col, row)) return false;
    if (def.category === 'production') {
      return this.hasAdjacentNode(col, row, def.needsNode);
    }
    return true;
  }

  worldToTile = worldToTile;
  tileToWorld = tileToWorld;
}
