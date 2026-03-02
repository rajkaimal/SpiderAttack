import { describe, it, expect } from 'vitest';
import {
  MAX_BULLETS,
  RELOAD_TIME,
  BASE_SPAWN_INTERVAL,
  SPIDER_MAX_RADIUS,
  WAVE_DATA,
  scoreForRadius,
  getComboMultiplier,
  hitTest,
} from '../game-logic.js';

// ─── scoreForRadius ──────────────────────────────────────────────────────────

describe('scoreForRadius', () => {
  it('returns 150 for tiny spiders (r < 25)', () => {
    expect(scoreForRadius(10)).toBe(150);
    expect(scoreForRadius(1)).toBe(150);
    expect(scoreForRadius(24)).toBe(150);
  });

  it('returns 80 for small spiders (25 <= r < 50)', () => {
    expect(scoreForRadius(25)).toBe(80);
    expect(scoreForRadius(30)).toBe(80);
    expect(scoreForRadius(49)).toBe(80);
  });

  it('returns 40 for medium spiders (50 <= r < 80)', () => {
    expect(scoreForRadius(50)).toBe(40);
    expect(scoreForRadius(60)).toBe(40);
    expect(scoreForRadius(79)).toBe(40);
  });

  it('returns 15 for large spiders (r >= 80)', () => {
    expect(scoreForRadius(80)).toBe(15);
    expect(scoreForRadius(100)).toBe(15);
    expect(scoreForRadius(110)).toBe(15);
  });

  it('awards more points for smaller spiders', () => {
    expect(scoreForRadius(10)).toBeGreaterThan(scoreForRadius(30));
    expect(scoreForRadius(30)).toBeGreaterThan(scoreForRadius(60));
    expect(scoreForRadius(60)).toBeGreaterThan(scoreForRadius(100));
  });
});

// ─── getComboMultiplier ──────────────────────────────────────────────────────

describe('getComboMultiplier', () => {
  it('returns 1x for combo 0-2', () => {
    expect(getComboMultiplier(0)).toBe(1);
    expect(getComboMultiplier(1)).toBe(1);
    expect(getComboMultiplier(2)).toBe(1);
  });

  it('returns 1.5x at exactly 3 combo', () => {
    expect(getComboMultiplier(3)).toBe(1.5);
  });

  it('returns 1.5x for combo 3-4', () => {
    expect(getComboMultiplier(4)).toBe(1.5);
  });

  it('returns 2x at exactly 5 combo', () => {
    expect(getComboMultiplier(5)).toBe(2);
  });

  it('returns 2x for combo above 5', () => {
    expect(getComboMultiplier(10)).toBe(2);
    expect(getComboMultiplier(50)).toBe(2);
  });

  it('multiplier increases with combo count', () => {
    expect(getComboMultiplier(5)).toBeGreaterThanOrEqual(getComboMultiplier(3));
    expect(getComboMultiplier(3)).toBeGreaterThanOrEqual(getComboMultiplier(0));
  });
});

// ─── hitTest ─────────────────────────────────────────────────────────────────

describe('hitTest', () => {
  it('returns true for a direct hit (same position)', () => {
    expect(hitTest(100, 100, 100, 100, 8, 20)).toBe(true);
  });

  it('returns true when click is within effective radius', () => {
    // effectiveRadius = 20*0.75 + 8 = 23
    expect(hitTest(100, 100, 122, 100, 8, 20)).toBe(true);
  });

  it('returns false when click is outside both radii', () => {
    expect(hitTest(0, 0, 200, 200, 8, 20)).toBe(false);
  });

  it('combines spider size and assist radius', () => {
    // effectiveRadius = 60*0.75 + 8 = 53
    expect(hitTest(100, 100, 152, 100, 8, 60)).toBe(true);
    // effectiveRadius = 20*0.75 + 8 = 23
    expect(hitTest(100, 100, 124, 100, 8, 20)).toBe(false);
  });

  it('returns true at exact boundary', () => {
    // effectiveRadius = 10*0.75 + 8 = 15.5 — should be a hit (<=)
    expect(hitTest(0, 0, 15.5, 0, 8, 10)).toBe(true);
  });

  it('returns false just past boundary', () => {
    // effectiveRadius = 10*0.75 + 8 = 15.5
    expect(hitTest(0, 0, 15.6, 0, 8, 10)).toBe(false);
  });

  it('works with diagonal distances', () => {
    // Distance = sqrt(10^2 + 20^2) ≈ 22.36, effectiveRadius = 10*0.75 + 8 = 15.5 — miss
    expect(hitTest(0, 0, 10, 20, 8, 10)).toBe(false);
    // Distance = 50, effectiveRadius = 60*0.75 + 8 = 53 — hit
    expect(hitTest(0, 0, 30, 40, 8, 60)).toBe(true);
  });
});

// ─── WAVE_DATA ───────────────────────────────────────────────────────────────

describe('WAVE_DATA', () => {
  it('has exactly 10 waves', () => {
    expect(WAVE_DATA).toHaveLength(10);
  });

  it('every wave has positive spider count and speed', () => {
    for (const wave of WAVE_DATA) {
      expect(wave.spiders).toBeGreaterThan(0);
      expect(wave.speed).toBeGreaterThan(0);
    }
  });

  it('spider count increases or stays same across waves', () => {
    for (let i = 1; i < WAVE_DATA.length; i++) {
      expect(WAVE_DATA[i].spiders).toBeGreaterThanOrEqual(WAVE_DATA[i - 1].spiders);
    }
  });

  it('speed increases or stays same across waves', () => {
    for (let i = 1; i < WAVE_DATA.length; i++) {
      expect(WAVE_DATA[i].speed).toBeGreaterThanOrEqual(WAVE_DATA[i - 1].speed);
    }
  });

  it('later waves have weave enabled', () => {
    expect(WAVE_DATA[4].weave).toBe(true);
    expect(WAVE_DATA[9].weave).toBe(true);
  });

  it('early waves do not have weave', () => {
    expect(WAVE_DATA[0].weave).toBeUndefined();
    expect(WAVE_DATA[3].weave).toBeUndefined();
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('MAX_BULLETS is a positive integer', () => {
    expect(MAX_BULLETS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_BULLETS)).toBe(true);
  });

  it('RELOAD_TIME is positive', () => {
    expect(RELOAD_TIME).toBeGreaterThan(0);
  });

  it('BASE_SPAWN_INTERVAL is positive', () => {
    expect(BASE_SPAWN_INTERVAL).toBeGreaterThan(0);
  });

  it('SPIDER_MAX_RADIUS is positive', () => {
    expect(SPIDER_MAX_RADIUS).toBeGreaterThan(0);
  });
});
