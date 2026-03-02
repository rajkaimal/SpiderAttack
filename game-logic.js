// ─── Constants ────────────────────────────────────────────────────────────────
export const MAX_BULLETS = 10;
export const RELOAD_TIME = 1000; // ms
export const BASE_SPAWN_INTERVAL = 500; // ms
export const SPIDER_MAX_RADIUS = 110;

export const WAVE_DATA = [
  { spiders: 10, speed: 0.075 },
  { spiders: 15, speed: 0.085 },
  { spiders: 20, speed: 0.095 },
  { spiders: 25, speed: 0.105 },
  { spiders: 30, speed: 0.115, weave: true },
  { spiders: 35, speed: 0.125, weave: true },
  { spiders: 40, speed: 0.135, weave: true },
  { spiders: 45, speed: 0.148, weave: true },
  { spiders: 50, speed: 0.162, weave: true },
  { spiders: 60, speed: 0.178, weave: true },
];

// ─── Pure Functions ───────────────────────────────────────────────────────────

export function scoreForRadius(r) {
  if (r < 25) return 150;
  if (r < 50) return 80;
  if (r < 80) return 40;
  return 15;
}

export function getComboMultiplier(combo) {
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

export function hitTest(clickX, clickY, spiderX, spiderY, hitRadius, spiderRadius) {
  const dx = spiderX - clickX;
  const dy = spiderY - clickY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const effectiveRadius = spiderRadius * 0.75 + hitRadius;
  return dist <= effectiveRadius;
}
