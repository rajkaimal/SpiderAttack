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
    expect(hitTest(100, 100, 100, 100, 40, 20)).toBe(true);
  });

  it('returns true when click is within hit radius', () => {
    expect(hitTest(100, 100, 120, 100, 40, 20)).toBe(true); // 20px away, hitRadius=40
  });

  it('returns false when click is outside both radii', () => {
    expect(hitTest(0, 0, 200, 200, 40, 20)).toBe(false);
  });

  it('uses max of hitRadius and spiderRadius', () => {
    // Spider at 55px away, hitRadius=40 but spiderRadius=60
    expect(hitTest(100, 100, 155, 100, 40, 60)).toBe(true);
    // Spider at 55px away, hitRadius=40 and spiderRadius=20 — both too small
    expect(hitTest(100, 100, 155, 100, 40, 20)).toBe(false);
  });

  it('returns true at exact boundary', () => {
    // Distance = 40, hitRadius = 40 — should be a hit (<=)
    expect(hitTest(0, 0, 40, 0, 40, 10)).toBe(true);
  });

  it('returns false just past boundary', () => {
    // Distance = 41, hitRadius = 40
    expect(hitTest(0, 0, 41, 0, 40, 10)).toBe(false);
  });

  it('works with diagonal distances', () => {
    // Distance = sqrt(30^2 + 40^2) = 50, hitRadius = 40 — miss
    expect(hitTest(0, 0, 30, 40, 40, 10)).toBe(false);
    // Same but with spiderRadius = 55 — hit
    expect(hitTest(0, 0, 30, 40, 40, 55)).toBe(true);
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
