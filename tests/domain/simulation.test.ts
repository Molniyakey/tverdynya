import { describe, expect, it } from 'vitest';
import { applyRunResult, createDefaultProfile } from '../../src/application/save';
import { createRun } from '../../src/domain/createRun';
import { GameSimulation } from '../../src/domain/GameSimulation';

describe('seeded run', () => {
  it('creates identical authored-map variants for the same seed', () => {
    const first = createRun('same-seed');
    const second = createRun('same-seed');
    expect(first.plots).toEqual(second.plots);
    expect(first.exploration).toEqual(second.exploration);
    expect(first.rngState).toBe(second.rngState);
  });
});

describe('fixed simulation', () => {
  it('does not advance while paused', () => {
    const simulation = new GameSimulation(createRun('pause'));
    simulation.dispatch({ type: 'set-speed', speed: 0 });
    simulation.advance(10);
    expect(simulation.state.timeOfDay).toBe(0);
  });

  it('changes time proportionally to selected speed', () => {
    const normal = new GameSimulation(createRun('speed'));
    const fast = new GameSimulation(createRun('speed'));
    fast.dispatch({ type: 'set-speed', speed: 2 });
    normal.advance(1);
    fast.advance(1);
    expect(fast.state.timeOfDay).toBeCloseTo(normal.state.timeOfDay * 2, 5);
  });

  it('rejects unaffordable construction without occupying a plot', () => {
    const simulation = new GameSimulation(createRun('cost'));
    simulation.state.resources.wood = 0;
    simulation.dispatch({ type: 'place-building', buildingId: 'lumber', plotId: 'settlement-2' });
    expect(simulation.state.plots.find((plot) => plot.id === 'settlement-2')?.occupiedBy).toBeNull();
    expect(simulation.drainEvents()).toContainEqual({ type: 'command-rejected', reason: 'Не хватает ресурсов' });
  });
});

describe('meta progression', () => {
  it('unlocks content but does not contain run resources', () => {
    const profile = applyRunResult(createDefaultProfile(), 'victory');
    expect(profile.unlockedRelicIds).toContain('ember-of-dawn');
    expect(profile.storyFlags).toContain('morok-defeated');
    expect(profile).not.toHaveProperty('resources');
  });
});
