import { initStars } from './game-stars.js';

// State factory for Spider Attack.
// Keeps the state shape in one place and makes resets predictable.
export function createInitialState({ MAX_BULLETS, STAR_COUNT, viewWidth, viewHeight }) {
  return {
    phase: 'start', // 'start' | 'playing' | 'gameover' | 'victory'
    wave: 0,
    score: 0,
    bullets: MAX_BULLETS,
    reloading: false,
    reloadStart: 0,
    reloadProgress: 0,
    combo: 0,
    comboMultiplier: 1,
    spiders: [],
    stars: initStars(STAR_COUNT, viewWidth, viewHeight),
    waveSpawned: 0,
    waveKilled: 0,
    lastSpawnTime: 0,
    waveTransition: false,
    waveTransitionTimer: 0,
    reloadWarningFlash: 0,
    shotFired: null, // { x, y, dx, dy, alpha }
    lastTime: 0,
    health: 100,
    maxHealth: 100,
    damageFlash: 0,
    totalKills: 0,
    shotsFired: 0,
    bestCombo: 0,
    comboBonus: 0,
    waveBonuses: 0,
    killScore: 0,
    deathEffects: [],
    deathParticles: [],
    mouseX: -9999,
    mouseY: -9999,
    nextShotTime: 0,
    lastDamageSfxTime: 0,
  };
}
