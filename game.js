import { MAX_BULLETS, RELOAD_TIME, BASE_SPAWN_INTERVAL, WAVE_DATA, scoreForRadius, getComboMultiplier, hitTest } from './game-logic.js';
import { createAudio } from './game-audio.js';
import { updateStars, drawStars } from './game-stars.js';
import { Spider } from './game-spider.js';
import { createRenderer } from './game-renderer.js';
import { setupInputHandlers } from './game-input.js';
import { createGameplaySystems } from './gameplay-systems.js';
import { createInitialState } from './game-state.js';
import { createViewport } from './game-viewport.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const AIM_ASSIST = isMobile ? 14 : 8; // px — limited assist so random shots do not dominate
const MISS_SHOT_COOLDOWN = 140; // ms penalty applied after a missed shot
const MOBILE_MIN_SHOT_INTERVAL = 140; // ms — hard cap to prevent tap-spam on mobile
const SPAWN_GRACE_MS = 150; // ms — newly spawned spiders cannot be hit immediately
const MIN_SPAWN_INTERVAL = 220; // ms — lower bound for late-wave spawn pacing
const BASE_BITE_DAMAGE = 16;
const BASE_GNAW_DPS = 12;
const STAR_COUNT = 150;
let playAgainBounds = null; // { x, y, w, h } for click detection
let reloadBtnBounds = null; // { x, y, r } for mobile reload button
const { audioCtx, sfxShoot, sfxKill, sfxReload, sfxDamage } = createAudio(isMobile);

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const viewport = createViewport(canvas);
function resize() {
  const { dpr } = viewport.resize();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);
const renderer = createRenderer({
  ctx,
  isMobile,
  MAX_BULLETS,
  WAVE_DATA,
  getViewSize: () => viewport.getViewSize(),
  getUiScale: () => viewport.getUiScale(),
});
const gameplay = createGameplaySystems({
  isMobile,
  AIM_ASSIST,
  MISS_SHOT_COOLDOWN,
  MOBILE_MIN_SHOT_INTERVAL,
  SPAWN_GRACE_MS,
  MIN_SPAWN_INTERVAL,
  BASE_SPAWN_INTERVAL,
  MAX_BULLETS,
  RELOAD_TIME,
  WAVE_DATA,
  scoreForRadius,
  getComboMultiplier,
  hitTest,
  Spider,
  sfxShoot,
  sfxKill,
  sfxReload,
  getViewSize: () => viewport.getViewSize(),
});

// ─── State ────────────────────────────────────────────────────────────────────
let state = {};

function initState() {
  const { viewWidth, viewHeight } = viewport.getViewSize();
  state = createInitialState({ MAX_BULLETS, STAR_COUNT, viewWidth, viewHeight });
}

// ─── Input ────────────────────────────────────────────────────────────────────
setupInputHandlers({
  canvas,
  audioCtx,
  getState: () => state,
  setMouse: (x, y) => {
    state.mouseX = x;
    state.mouseY = y;
  },
  onStart: () => gameplay.startGame(state),
  onRestart: () => {
    playAgainBounds = null;
    initState();
    state.phase = 'start';
  },
  onShoot: (x, y) => gameplay.shoot(state, x, y),
  onReload: () => gameplay.startReload(state),
  getPlayAgainBounds: () => playAgainBounds,
  getReloadBtnBounds: () => reloadBtnBounds,
});

// ─── Game Loop ────────────────────────────────────────────────────────────────
function loop(now) {
  const dt = Math.min(now - (state.lastTime || now), 50);
  state.lastTime = now;
  const healthBefore = state.health;
  canvas.style.cursor = state.phase === 'playing' ? 'none' : 'default';
  const { viewWidth, viewHeight } = viewport.getViewSize();

  ctx.clearRect(0, 0, viewWidth, viewHeight);

  // Background
  ctx.fillStyle = '#000005';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  updateStars(state.stars, dt, state.phase, viewWidth, viewHeight);
  drawStars(ctx, state.stars);

  if (state.phase === 'start') {
    renderer.drawStartScreen(state);
    playAgainBounds = null;
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'gameover') {
    playAgainBounds = renderer.drawScreen(state, 'GAME OVER', '#f00').playAgainBounds;
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'victory') {
    playAgainBounds = renderer.drawScreen(state, 'VICTORY!', '#0f8').playAgainBounds;
    requestAnimationFrame(loop);
    return;
  }

  // Playing
  gameplay.updateReload(state, now);
  gameplay.updateWave(state, dt, now);

  if (state.reloadWarningFlash > 0) state.reloadWarningFlash -= dt;

  // Update shot alpha
  if (state.shotFired) {
    state.shotFired.alpha -= dt * 0.03;
    if (state.shotFired.alpha <= 0) state.shotFired = null;
  }

  // Update spiders
  const wavePressure = 1 + state.wave * 0.045;
  const biteDamage = Math.round(BASE_BITE_DAMAGE * wavePressure);
  const gnawDps = BASE_GNAW_DPS * wavePressure;
  for (let i = state.spiders.length - 1; i >= 0; i--) {
    const sp = state.spiders[i];
    sp.update(dt);

    if (sp.progress >= 1.0) {
      // Spider reached player — bites for a chunk of health, then gone
      state.health = Math.max(0, state.health - biteDamage);
      state.damageFlash = 500;
      state.waveKilled++;
      state.spiders.splice(i, 1);
    } else if (sp.progress > 0.65) {
      // Spider very close — gnawing continuously
      const intensity = (sp.progress - 0.65) / 0.35;
      state.health = Math.max(0, state.health - intensity * gnawDps * dt * 0.001);
      state.damageFlash = Math.max(state.damageFlash, intensity * 300);
    }
  }

  if (state.health < healthBefore && now - state.lastDamageSfxTime >= 170) {
    state.lastDamageSfxTime = now;
    sfxDamage();
  }

  if (state.damageFlash > 0) state.damageFlash -= dt;

  // Red damage flash overlay
  if (state.damageFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.4, (state.damageFlash / 500) * 0.4);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.restore();
  }

  if (state.health <= 0) {
    state.phase = 'gameover';
  }

  // Draw spiders (smallest first so large ones render on top)
  // Insertion sort — nearly free on an already-sorted array (progress only increases)
  for (let i = 1; i < state.spiders.length; i++) {
    const key = state.spiders[i];
    let j = i - 1;
    while (j >= 0 && state.spiders[j].progress > key.progress) {
      state.spiders[j + 1] = state.spiders[j];
      j--;
    }
    state.spiders[j + 1] = key;
  }
  for (const sp of state.spiders) {
    sp.draw(ctx, viewWidth, viewHeight, now);
  }

  // Death effects — burn up
  for (let i = state.deathEffects.length - 1; i >= 0; i--) {
    const fx = state.deathEffects[i];
    fx.t += dt * 0.0028;
    if (fx.t >= 1) {
      state.deathEffects.splice(i, 1);
      continue;
    }
    const shrink = 1 - fx.t;
    const alpha = shrink;
    const r = fx.r * shrink;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(fx.x, fx.y);
    // White-hot core fading to orange
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, `rgba(255,255,255,${1 - fx.t * 0.5})`);
    grad.addColorStop(0.5, `rgba(255,${Math.round(160 - fx.t * 120)},30,0.8)`);
    grad.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Death particles — lingering embers
  for (let i = state.deathParticles.length - 1; i >= 0; i--) {
    const p = state.deathParticles[i];
    p.t += dt * 0.001;
    if (p.t >= p.life) {
      state.deathParticles.splice(i, 1);
      continue;
    }
    const lifeFrac = 1 - p.t / p.life;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.988;
    p.vy = p.vy * 0.988 + 0.00003 * dt;

    ctx.save();
    ctx.globalAlpha = lifeFrac;
    const pr = Math.max(0.4, p.size * lifeFrac);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr);
    grad.addColorStop(0, 'rgba(255,245,220,0.95)');
    grad.addColorStop(0.4, 'rgba(255,150,45,0.8)');
    grad.addColorStop(1, 'rgba(220,60,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderer.drawShot(state);
  const { reloadBtnBounds: nextReloadBtnBounds } = renderer.drawHUD(state);
  reloadBtnBounds = nextReloadBtnBounds;
  renderer.drawWaveTransition(state);
  renderer.drawCrosshair(state);

  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initState();
requestAnimationFrame(loop);
