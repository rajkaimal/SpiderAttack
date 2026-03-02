import { MAX_BULLETS, RELOAD_TIME, BASE_SPAWN_INTERVAL, SPIDER_MAX_RADIUS, WAVE_DATA, scoreForRadius, getComboMultiplier, hitTest } from './game-logic.js';

// ─── Audio ───────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function sfxShoot() {
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(2200, t);
  osc.frequency.exponentialRampToValueAtTime(260, t + 0.14);
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.14);
}

function sfxKill() {
  const t = audioCtx.currentTime + 0.02;

  // Low, short thud at conservative volume.
  const thud = audioCtx.createOscillator();
  const thudGain = audioCtx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(120, t);
  thud.frequency.exponentialRampToValueAtTime(65, t + 0.1);
  thudGain.gain.setValueAtTime(0.06, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  thud.connect(thudGain).connect(audioCtx.destination);
  thud.start(t);
  thud.stop(t + 0.12);

  // Very subtle texture so it feels less synthetic.
  const bufLen = Math.floor(audioCtx.sampleRate * 0.08);
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = 1 - i / bufLen;
    data[i] = (Math.random() * 2 - 1) * env * 0.25;
  }

  const noise = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const noiseGain = audioCtx.createGain();
  noise.buffer = buf;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(260, t);
  noiseGain.gain.setValueAtTime(0.02, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(filter).connect(noiseGain).connect(audioCtx.destination);
  noise.start(t);
  noise.stop(t + 0.08);
}

function sfxReload() {
  // Two-click mechanical sound
  for (const delay of [0, 0.12]) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime + delay);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + delay + 0.04);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.06);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + 0.06);
  }
}

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

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let uiScale = 1;
let viewWidth = 0;
let viewHeight = 0;
function resize() {
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;

  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${viewWidth}px`;
  canvas.style.height = `${viewHeight}px`;
  canvas.width = Math.round(viewWidth * dpr);
  canvas.height = Math.round(viewHeight * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  uiScale = Math.min(viewWidth / 960, viewHeight / 640, 1.3);
}

function sfxDamage() {
  const t = audioCtx.currentTime;
  const peak = isMobile ? 0.08 : 0.055;

  const ping = (start, dur, f0, f1, level) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur);
  };

  // Two short mid-frequency pings are easier to hear on phone speakers.
  ping(t, 0.045, 920, 620, peak);
  ping(t + 0.055, 0.04, 760, 520, peak * 0.75);
}
function scaledFont(size, bold, minPx = 0) {
  const px = Math.max(minPx, Math.round(size * uiScale));
  return `${bold ? 'bold ' : ''}${px}px monospace`;
}
resize();
window.addEventListener('resize', resize);

// ─── State ────────────────────────────────────────────────────────────────────
let state = {};

function initState() {
  state = {
    phase: 'start',   // 'start' | 'playing' | 'gameover' | 'victory'
    wave: 0,
    score: 0,
    bullets: MAX_BULLETS,
    reloading: false,
    reloadStart: 0,
    reloadProgress: 0,
    combo: 0,
    comboMultiplier: 1,
    spiders: [],
    stars: initStars(),
    waveSpawned: 0,
    waveKilled: 0,
    lastSpawnTime: 0,
    waveTransition: false,
    waveTransitionTimer: 0,
    reloadWarningFlash: 0,
    shotFired: null,   // { x, y, dx, dy, alpha }
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

// ─── Stars ────────────────────────────────────────────────────────────────────
function initStars() {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push(randomStar());
  }
  return stars;
}

function randomStar() {
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * Math.max(viewWidth, viewHeight) * 0.6;
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    z: Math.random(),  // 0=far, 1=near
    brightness: 0.4 + Math.random() * 0.6,
  };
}

function updateStars(dt) {
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const speed = state.phase === 'playing' ? 0.4 : 0.1;

  for (const s of state.stars) {
    // Move outward from center (stars rushing past)
    const dx = s.x - cx;
    const dy = s.y - cy;
    s.z += dt * speed * 0.001;

    if (s.z >= 1) {
      Object.assign(s, randomStar());
      s.z = 0;
    }

    const scale = s.z;
    s.sx = cx + dx * scale;
    s.sy = cy + dy * scale;
    // Keep stars as tiny specks even at peak depth.
    s.sr = 0.04 + scale * 0.55;
    s.salpha = s.brightness * scale;
  }
}

function drawStars() {
  for (const s of state.stars) {
    if (s.sx == null) continue;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, s.sr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.salpha})`;
    ctx.fill();
  }
}

// ─── Spider ───────────────────────────────────────────────────────────────────
class Spider {
  constructor(angle, speed, weave, spawnTime) {
    this.angle = angle;
    this.speed = speed;
    this.weave = weave || false;
    this.progress = 0;
    this.spawnTime = spawnTime ?? performance.now();
    this.weaveOffset = Math.random() * Math.PI * 2;
    this.weaveAmp = 0.03 + Math.random() * 0.04;
    this.weaveFreq = 1.5 + Math.random();
    // Wider center jitter for more random-looking approach vectors.
    this.originOffsetX = (Math.random() - 0.5) * 120;
    this.originOffsetY = (Math.random() - 0.5) * 120;
  }

  get radius() {
    return Math.max(1, this.progress * SPIDER_MAX_RADIUS);
  }

  get screenPos() {
    const cx = viewWidth / 2 + this.originOffsetX;
    const cy = viewHeight / 2 + this.originOffsetY;
    const expansion = this.progress;
    const maxDist = Math.min(viewWidth, viewHeight) * 0.44;
    const dist = expansion * maxDist;
    let angle = this.angle;
    if (this.weave) {
      angle += Math.sin(this.progress * Math.PI * 2 * this.weaveFreq + this.weaveOffset) * this.weaveAmp;
    }
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  }

  update(dt) {
    this.progress += this.speed * dt * 0.001;
  }

  draw(ctx) {
    const { x, y } = this.screenPos;
    const r = this.radius;
    const alpha = Math.min(1, this.progress * 10);
    const px = Math.max(1, Math.round(r / 10));
    const walk = Math.sin(performance.now() * 0.005 + this.weaveOffset);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));

    const P = (gx, gy, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(gx * px), Math.round(gy * px), px, px);
    };

    const line = (x0, y0, x1, y1, col, out) => {
      [x0,y0,x1,y1] = [Math.round(x0),Math.round(y0),Math.round(x1),Math.round(y1)];
      let dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1, e=dx+dy;
      for(;;) {
        if(out){ctx.fillStyle=out; ctx.fillRect(Math.round(x0*px)-1,Math.round(y0*px)-1,px+2,px+2);}
        P(x0,y0,col);
        if(x0===x1&&y0===y1) break;
        const e2=2*e;
        if(e2>=dy){e+=dy; x0+=sx;}
        if(e2<=dx){e+=dx; y0+=sy;}
      }
    };

    const leg = (ax,ay,kx,ky,tx,ty) => {
      line(ax,ay,kx,ky,'#3c1c0a','#100600');
      line(kx,ky,tx,ty,'#2c1006','#100600');
      P(kx,ky,'#8a4020');
    };

    const phA = walk * 1.3, phB = -walk * 1.3;

    // ── LEGS — front-facing: body on top, ALL tips reach DOWNWARD ──
    // Like a tarantula walking toward you — legs touch ground BELOW the body
    for (const s of [-1, 1]) {
      // Front pair — arches up over head, tip curves back DOWN to body level
      leg(s*3, -3,  s*7, -7+phA,  s*12,  0+phA*0.5);
      // Second pair — extends out, slight upward arc, then curves down
      leg(s*4, -1,  s*9, -2+phB,  s*13,  4+phB*0.4);
      // Third pair — extends out and downward
      leg(s*4,  1,  s*9,  4+phB,  s*12,  8+phB*0.4);
      // Rear pair — steeply downward
      leg(s*3,  2,  s*7,  8+phA,  s*10, 12+phA*0.5);
    }

    // ── ABDOMEN (behind head in front view, larger oval) ─────
    for (const [gy, hw] of [
      [2,2],[3,3],[4,4],[5,5],[6,5],[7,4],[8,3],[9,2],[10,1]
    ]) {
      for (let gx = -hw; gx <= hw; gx++) {
        const edge = Math.abs(gx) === hw;
        const hi = !edge && gy >= 4 && gy <= 6 && Math.abs(gx) <= 2;
        P(gx, gy, edge ? '#2c1400' : hi ? '#6a2a10' : '#4a1c08');
      }
    }

    // ── PEDICEL (narrow waist) ──────────────────────────────
    P(-1, 1, '#2a1206'); P(0, 1, '#3a1808'); P(1, 1, '#2a1206');

    // ── CEPHALOTHORAX (round face, front-facing dome) ────────
    for (const [gy, hw] of [
      [-6,1],[-5,2],[-4,3],[-3,3],[-2,3],[-1,2],[0,1]
    ]) {
      for (let gx = -hw; gx <= hw; gx++) {
        const edge = Math.abs(gx) === hw;
        const hi = !edge && gy >= -5 && gy <= -2 && Math.abs(gx) <= 1;
        P(gx, gy, edge ? '#3a1800' : hi ? '#c85020' : '#9a3818');
      }
    }

    // ── CHELICERAE (fang bases below face) ───────────────────
    P(-1, 0, '#5a2010'); P(1, 0, '#5a2010');

    // ── EYES (staring at the player) ─────────────────────────
    P(-2,-5,'#ffffff'); P(-1,-5,'#ffffff');   // left sclera
    P( 1,-5,'#ffffff'); P( 2,-5,'#ffffff');   // right sclera
    P(-2,-4,'#cc1100'); P(-1,-4,'#cc1100');   // left iris
    P( 1,-4,'#cc1100'); P( 2,-4,'#cc1100');   // right iris
    P(-1,-4,'#110000'); P(1,-4,'#110000');    // dark pupils

    ctx.restore();
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function updateCombo(hit) {
  if (hit) {
    state.combo++;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.comboMultiplier = getComboMultiplier(state.combo);
  } else {
    state.combo = 0;
    state.comboMultiplier = 1;
  }
}

// ─── Input ────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  state.mouseX = e.clientX;
  state.mouseY = e.clientY;
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  if (e.button === 2) {
    // Right click — reload
    if (state.phase === 'playing') startReload();
    return;
  }
  if (e.button !== 0) return;

  if (state.phase === 'start') {
    startGame();
    return;
  }
  if (state.phase === 'gameover' || state.phase === 'victory') {
    if (playAgainBounds &&
        e.clientX >= playAgainBounds.x && e.clientX <= playAgainBounds.x + playAgainBounds.w &&
        e.clientY >= playAgainBounds.y && e.clientY <= playAgainBounds.y + playAgainBounds.h) {
      playAgainBounds = null;
      initState();
      state.phase = 'start';
    }
    return;
  }
  if (state.phase === 'playing') {
    shoot(e.clientX, e.clientY);
  }
});

// Touch input for mobile
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  audioCtx.resume(); // iOS requires user gesture to start audio
  const t = e.touches[0];
  const tx = t.clientX;
  const ty = t.clientY;
  state.mouseX = tx;
  state.mouseY = ty;

  if (state.phase === 'start') {
    startGame();
    return;
  }
  if (state.phase === 'gameover' || state.phase === 'victory') {
    if (playAgainBounds &&
        tx >= playAgainBounds.x && tx <= playAgainBounds.x + playAgainBounds.w &&
        ty >= playAgainBounds.y && ty <= playAgainBounds.y + playAgainBounds.h) {
      playAgainBounds = null;
      initState();
      state.phase = 'start';
    }
    return;
  }
  if (state.phase === 'playing') {
    // Check reload button first
    if (reloadBtnBounds) {
      const dx = tx - reloadBtnBounds.x;
      const dy = ty - reloadBtnBounds.y;
      if (dx * dx + dy * dy <= reloadBtnBounds.r * reloadBtnBounds.r) {
        startReload();
        return;
      }
    }
    shoot(tx, ty);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  state.mouseX = t.clientX;
  state.mouseY = t.clientY;
}, { passive: false });

// ─── Shooting ─────────────────────────────────────────────────────────────────
function shoot(mx, my) {
  const now = performance.now();
  if (state.reloading) return;
  if (state.waveTransition) return;
  if (now < state.nextShotTime) return;

  if (state.bullets <= 0) {
    state.reloadWarningFlash = 800;
    return;
  }

  state.bullets--;
  state.shotsFired++;
  sfxShoot();
  if (isMobile) {
    state.nextShotTime = Math.max(state.nextShotTime, now + MOBILE_MIN_SHOT_INTERVAL);
  }

  // Record shot for visual
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const vx = mx - cx;
  const vy = my - cy;
  const len = Math.hypot(vx, vy) || 1;
  state.shotFired = { x: mx, y: my, dx: vx / len, dy: vy / len, alpha: 1 };

  // Hit detection
  let hit = false;
  for (let i = state.spiders.length - 1; i >= 0; i--) {
    const sp = state.spiders[i];
    if (now - sp.spawnTime < SPAWN_GRACE_MS) continue;
    const pos = sp.screenPos;
    if (hitTest(mx, my, pos.x, pos.y, AIM_ASSIST, sp.radius)) {
      const base = scoreForRadius(sp.radius);
      const pts = Math.round(base * state.comboMultiplier);
      state.score += pts;
      state.killScore += base;
      state.comboBonus += pts - base;
      state.deathEffects.push({ x: pos.x, y: pos.y, r: sp.radius, t: 0 });
      for (let p = 0; p < 8; p++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 0.03 + Math.random() * 0.075;
        state.deathParticles.push({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          size: Math.max(1, sp.radius * (0.05 + Math.random() * 0.06)),
          t: 0,
          life: 0.75 + Math.random() * 0.45,
        });
      }
      state.spiders.splice(i, 1);
      state.waveKilled++;
      state.totalKills++;
      hit = true;
      sfxKill();
      break; // one bullet, one spider
    }
  }

  if (!hit) {
    state.nextShotTime = now + MISS_SHOT_COOLDOWN;
  }
  updateCombo(hit);
}

// ─── Reload ───────────────────────────────────────────────────────────────────
function startReload() {
  if (state.reloading) return;
  if (state.bullets >= MAX_BULLETS) return;
  state.reloading = true;
  state.reloadStart = performance.now();
  state.reloadProgress = 0;
  sfxReload();
}

function updateReload(now) {
  if (!state.reloading) return;
  state.reloadProgress = Math.min(1, (now - state.reloadStart) / RELOAD_TIME);
  if (state.reloadProgress >= 1) {
    state.bullets = MAX_BULLETS;
    state.reloading = false;
  }
}

// ─── Wave Management ──────────────────────────────────────────────────────────
function startGame() {
  state.phase = 'playing';
  startWave(0);
}

function startWave(waveIndex) {
  state.wave = waveIndex;
  state.waveSpawned = 0;
  state.waveKilled = 0;
  state.lastSpawnTime = performance.now();
  state.waveTransition = true;
  state.waveTransitionTimer = 2200;
}

function updateWave(dt, now) {
  const waveData = WAVE_DATA[state.wave];
  const waveFactor = state.wave / (WAVE_DATA.length - 1); // 0..1
  const spawnInterval = Math.max(
    MIN_SPAWN_INTERVAL,
    BASE_SPAWN_INTERVAL * (1 - waveFactor * 0.45)
  );

  if (state.waveTransition) {
    state.waveTransitionTimer -= dt;
    if (state.waveTransitionTimer <= 0) state.waveTransition = false;
    return;
  }

  // Spawn spiders — initial burst then steady stream
  if (state.waveSpawned < waveData.spiders && now - state.lastSpawnTime >= spawnInterval) {
    // Bigger bursts later in the game to increase pressure.
    const earlyBatch = state.wave >= 6 ? 4 : 3;
    const steadyBatch = state.wave >= 8 ? 2 : 1;
    const batch = state.waveSpawned < 4 ? earlyBatch : steadyBatch;
    for (let b = 0; b < batch && state.waveSpawned < waveData.spiders; b++) {
      const angle = Math.random() * Math.PI * 2;
      state.spiders.push(new Spider(angle, waveData.speed, waveData.weave, now));
      state.waveSpawned++;
    }
    state.lastSpawnTime = now;
  }

  // Check wave complete
  if (state.waveKilled >= waveData.spiders && state.spiders.length === 0) {
    state.score += 500;
    state.waveBonuses += 500;
    const nextWave = state.wave + 1;
    if (nextWave >= WAVE_DATA.length) {
      state.phase = 'victory';
    } else {
      startWave(nextWave);
    }
  }
}

// ─── Drawing Helpers ──────────────────────────────────────────────────────────
function drawCrosshair(x, y) {
  if (state.phase !== 'playing') return;
  if (x < 0 || y < 0 || x > viewWidth || y > viewHeight) return;
  const size = 18;
  const gap = 5;
  ctx.save();
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#0f0';
  ctx.shadowBlur = 6;

  // Horizontal
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x - gap, y);
  ctx.moveTo(x + gap, y);
  ctx.lineTo(x + size, y);
  // Vertical
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y - gap);
  ctx.moveTo(x, y + gap);
  ctx.lineTo(x, y + size);
  // Circle
  ctx.moveTo(x + gap + 1, y);
  ctx.arc(x, y, gap + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  const s = uiScale;
  const pad = Math.round(20 * s);
  ctx.save();

  // Wave
  ctx.font = scaledFont(22, true);
  ctx.fillStyle = '#aef';
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 8;
  ctx.fillText(`WAVE ${state.wave + 1} / ${WAVE_DATA.length}`, pad, pad + 22 * s);

  // Health bar
  const hpFrac = Math.max(0, state.health / state.maxHealth);
  const hpBarW = Math.round(180 * s);
  const hpBarH = Math.round(12 * s);
  const hpX = pad;
  const hpY = pad + Math.round(34 * s);
  const hpColor = hpFrac > 0.5 ? '#22dd22' : hpFrac > 0.25 ? '#ffcc00' : '#ff2222';
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#222';
  ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
  ctx.fillStyle = hpColor;
  ctx.shadowColor = hpColor;
  ctx.shadowBlur = hpFrac < 0.25 ? 8 : 0;
  ctx.fillRect(hpX, hpY, Math.round(hpBarW * hpFrac), hpBarH);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.strokeRect(hpX, hpY, hpBarW, hpBarH);
  ctx.font = scaledFont(11, false);
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'left';
  ctx.fillText(`HEALTH ${Math.ceil(state.health)}`, hpX + hpBarW + 8, hpY + hpBarH * 0.8);

  // Score
  const scoreText = `SCORE: ${state.score.toLocaleString()}`;
  ctx.textAlign = 'right';
  ctx.font = scaledFont(22, true);
  ctx.fillStyle = '#aef';
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 8;
  ctx.fillText(scoreText, viewWidth - pad, pad + 22 * s);

  // Combo
  if (state.comboMultiplier > 1) {
    ctx.font = scaledFont(18, true);
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#f80';
    ctx.fillText(`×${state.comboMultiplier} COMBO!`, viewWidth - pad, pad + 48 * s);
  }

  // Bullets
  ctx.textAlign = 'left';
  const pipR = Math.round(8 * s);
  const pipGap = Math.round(5 * s);
  const bulletY = viewHeight - pad - pipR - 2;

  ctx.font = scaledFont(22, true);
  ctx.fillStyle = '#aef';
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 8;
  ctx.fillText('ROUNDS', pad, bulletY - pipR - Math.round(10 * s));
  ctx.shadowBlur = 0;

  for (let i = 0; i < MAX_BULLETS; i++) {
    const px = pad + i * (pipR * 2 + pipGap);
    ctx.beginPath();
    ctx.arc(px, bulletY, pipR, 0, Math.PI * 2);
    if (i < state.bullets) {
      ctx.fillStyle = '#ff0';
      ctx.shadowColor = '#f80';
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = '#333';
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Reload arc (desktop only — mobile has its own reload button)
  if (state.reloading && !isMobile) {
    const arcX = pad + MAX_BULLETS * (pipR * 2 + pipGap) + Math.round(20 * s);
    const arcY = bulletY;
    ctx.beginPath();
    ctx.arc(arcX, arcY, Math.round(14 * s), -Math.PI / 2, -Math.PI / 2 + state.reloadProgress * Math.PI * 2);
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.font = scaledFont(11, false);
    ctx.fillStyle = '#0f0';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.fillText('RELOAD', arcX + Math.round(20 * s), arcY + 5);
  }

  // Reload status / warning
  if (state.reloading) {
    ctx.font = scaledFont(24, true);
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 14;
    ctx.textAlign = 'center';
    ctx.fillText('RELOADING...', viewWidth / 2, viewHeight - Math.round(80 * s));
  } else if (state.reloadWarningFlash > 0) {
    const alpha = Math.min(1, state.reloadWarningFlash / 400);
    ctx.font = scaledFont(28, true);
    ctx.fillStyle = `rgba(255,50,50,${alpha})`;
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 16;
    ctx.textAlign = 'center';
    ctx.fillText('RELOAD!', viewWidth / 2, viewHeight - Math.round(80 * s));
  }

  // Mobile reload button
  if (isMobile) {
    const btnR = Math.round(50 * s);
    const iconR = Math.round(21 * s);
    const btnLift = Math.max(Math.round(52 * s), 30);
    const btnX = viewWidth - pad - btnR;
    const btnY = viewHeight - pad - btnR - btnLift;
    reloadBtnBounds = { x: btnX, y: btnY, r: btnR + 22 }; // extra tap forgiveness on mobile
    const needsReload = state.bullets <= 0 && !state.reloading;
    const blinkOn = needsReload ? (Math.floor(performance.now() / 180) % 2 === 0) : false;
    const alertCol = blinkOn ? '#ff2222' : '#00ff66';
    const ringCol = state.reloading ? '#0f0' : needsReload ? alertCol : '#666';
    const iconCol = state.reloading ? '#0f0' : needsReload ? alertCol : '#aaa';

    // Button background
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
    ctx.fillStyle = state.reloading
      ? 'rgba(0,255,0,0.15)'
      : needsReload
        ? (blinkOn ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,120,0.13)')
        : 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Circular arrow icon
    ctx.beginPath();
    ctx.arc(btnX, btnY, iconR, -Math.PI * 0.8, Math.PI * 0.5);
    ctx.strokeStyle = iconCol;
    ctx.lineWidth = 3;
    ctx.shadowColor = state.reloading || needsReload ? iconCol : 'transparent';
    ctx.shadowBlur = state.reloading || needsReload ? 8 : 0;
    ctx.stroke();

    // Arrowhead
    const tipAngle = Math.PI * 0.5;
    const tipX = btnX + Math.cos(tipAngle) * iconR;
    const tipY = btnY + Math.sin(tipAngle) * iconR;
    const arr = Math.round(6 * s);
    ctx.beginPath();
    ctx.moveTo(tipX - arr, tipY - arr + 1);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX + arr, tipY - arr + 1);
    ctx.strokeStyle = iconCol;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Reload progress ring
    if (state.reloading) {
      ctx.beginPath();
      ctx.arc(btnX, btnY, btnR - 4, -Math.PI / 2, -Math.PI / 2 + state.reloadProgress * Math.PI * 2);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#0f0';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label below button
    ctx.font = scaledFont(22, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aef';
    ctx.shadowColor = state.reloading ? '#0f0' : '#0af';
    ctx.shadowBlur = state.reloading ? 8 : 6;
    ctx.fillText('RELOAD', btnX, btnY + btnR + Math.max(Math.round(30 * s), 20));
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawShot() {
  if (!state.shotFired) return;
  const { x, y, dx, dy, alpha } = state.shotFired;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));

  // Tiny forward streak to imply projectile direction.
  const streakGrad = ctx.createLinearGradient(0, 0, 52, 0);
  streakGrad.addColorStop(0, 'rgba(210,235,255,1)');
  streakGrad.addColorStop(0.38, 'rgba(85,170,255,0.95)');
  streakGrad.addColorStop(1, 'rgba(35,120,255,0)');
  ctx.fillStyle = streakGrad;
  ctx.fillRect(-3.5, -2.8, 55, 5.6);

  // Directional cone flash (blue) instead of radial explosion.
  const coneGrad = ctx.createLinearGradient(0, 0, 38, 0);
  coneGrad.addColorStop(0, 'rgba(225,242,255,1)');
  coneGrad.addColorStop(0.55, 'rgba(90,175,255,0.86)');
  coneGrad.addColorStop(1, 'rgba(30,110,255,0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(33, -12);
  ctx.lineTo(42, 0);
  ctx.lineTo(33, 12);
  ctx.closePath();
  ctx.fill();

  // White-hot muzzle core + soft halo.
  ctx.fillStyle = '#f5fbff';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  halo.addColorStop(0, 'rgba(200,235,255,0.5)');
  halo.addColorStop(1, 'rgba(95,175,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScreen(title, color) {
  const s = uiScale;
  const textBoost = isMobile ? 1.35 : 1;
  const panelFont = (size, bold) => scaledFont(size * textBoost, bold, isMobile ? Math.round(size * 0.95) : 0);
  const statsStep = isMobile ? Math.max(28 * s, 24) : 28 * s;
  const breakdownStep = isMobile ? Math.max(24 * s, 22) : 24 * s;
  const sectionGap = isMobile ? Math.max(22 * s, 18) : 22 * s;
  const dividerGapTop = isMobile ? Math.max(46 * s, 36) : Math.max(34 * s, 26);
  const statsStartGap = isMobile ? Math.max(42 * s, 34) : Math.max(36 * s, 30);
  const dividerBeforeGap = isMobile ? Math.max(18 * s, 14) : 8 * s;
  const dividerAfterGap = isMobile ? Math.max(28 * s, 22) : sectionGap;
  const buttonGap = isMobile ? Math.max(50 * s, 42) : 50 * s;
  const buttonBoxH = isMobile ? Math.max(34 * s, 32) : 34 * s;
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const titleY = cy - 130 * s;
  const topDividerY = titleY + dividerGapTop;
  const statsStartY = topDividerY + statsStartGap;
  const accuracy = state.shotsFired > 0
    ? Math.round((state.totalKills / state.shotsFired) * 100) : 0;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.textAlign = 'center';

  // Title
  ctx.font = scaledFont(72, true);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(title, cx, titleY);

  // Divider
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 220 * s, topDividerY);
  ctx.lineTo(cx + 220 * s, topDividerY);
  ctx.stroke();

  // Combat stats
  const stats = [
    ['WAVE',       `${state.wave + 1} / ${WAVE_DATA.length}`],
    ['KILLS',      state.totalKills.toString()],
    ['SHOTS',      state.shotsFired.toString()],
    ['ACCURACY',   `${accuracy}%`],
    ['BEST COMBO', state.bestCombo.toString()],
  ];

  ctx.textAlign = 'left';
  const colX = cx - 200 * s;
  const valX = cx + 80 * s;
  let rowY = statsStartY;
  for (const [label, val] of stats) {
    ctx.font = panelFont(18, true);
    ctx.fillStyle = '#aef';
    ctx.shadowColor = '#0af';
    ctx.shadowBlur = 8;
    ctx.fillText(label, colX, rowY);

    ctx.font = panelFont(18, false);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fillText(val, valX, rowY);
    rowY += statsStep;
  }

  // Score breakdown divider
  rowY += dividerBeforeGap;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(colX, rowY);
  ctx.lineTo(valX + 120 * s, rowY);
  ctx.stroke();
  rowY += dividerAfterGap;

  // Score breakdown
  const breakdown = [
    ['KILL PTS',    state.killScore.toLocaleString()],
    ['COMBO BONUS', `+${state.comboBonus.toLocaleString()}`],
    ['WAVE BONUS',  `+${state.waveBonuses.toLocaleString()}`],
  ];

  for (const [label, val] of breakdown) {
    ctx.font = panelFont(16, false);
    ctx.fillStyle = '#aaa';
    ctx.shadowBlur = 0;
    ctx.fillText(label, colX, rowY);
    ctx.fillText(val, valX, rowY);
    rowY += breakdownStep;
  }

  // Total
  rowY += 4 * s;
  ctx.font = panelFont(22, true);
  ctx.fillStyle = '#ff0';
  ctx.shadowColor = '#f80';
  ctx.shadowBlur = 8;
  ctx.fillText('TOTAL', colX, rowY);
  ctx.fillText(state.score.toLocaleString(), valX, rowY);

  // Play again
  ctx.textAlign = 'center';
  ctx.shadowBlur = 0;
  rowY += buttonGap;
  ctx.font = panelFont(22, true);
  ctx.fillStyle = '#0f0';
  ctx.shadowColor = '#0f0';
  ctx.shadowBlur = 14;
  const btnText = '[ PLAY AGAIN ]';
  const btnW = ctx.measureText(btnText).width;
  playAgainBounds = { x: cx - btnW / 2 - 10, y: rowY - buttonBoxH * 0.65, w: btnW + 20, h: buttonBoxH };
  ctx.fillText(btnText, cx, rowY);

  ctx.restore();
}

function drawWaveTransition() {
  if (!state.waveTransition) return;
  const alpha = Math.min(1, state.waveTransitionTimer / 800);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = scaledFont(56, true);
  ctx.fillStyle = '#0af';
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 24;
  ctx.fillText(`WAVE ${state.wave + 1}`, viewWidth / 2, viewHeight / 2);
  ctx.font = scaledFont(22, false);
  ctx.fillStyle = '#aef';
  ctx.shadowBlur = 8;
  ctx.fillText('Get ready!', viewWidth / 2, viewHeight / 2 + 50 * uiScale);
  ctx.restore();
}

function drawStartScreen() {
  const s = uiScale;
  const textBoost = isMobile ? 1.4 : 1;
  const panelFont = (size, bold) => scaledFont(size * textBoost, bold, isMobile ? Math.round(size * 1.05) : 0);
  const rowStepSingle = isMobile ? Math.max(24 * s, 24) : 24 * s;
  const rowStepDouble = isMobile ? Math.max(26 * s, 24) : 26 * s;
  const promptGap = isMobile ? Math.max(48 * s, 40) : Math.max(82 * s, 68);
  const promptBottomPad = isMobile ? Math.max(70 * s, 58) : Math.max(76 * s, 64);
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const titleY = cy - 170 * s;
  const taglineY = cy - 120 * s;
  const dividerY = taglineY + (isMobile ? Math.max(30 * s, 24) : Math.max(28 * s, 20));
  const howToY = dividerY + (isMobile ? Math.max(26 * s, 22) : 27 * s);
  const rowsStartY = howToY + (isMobile ? Math.max(34 * s, 30) : 35 * s);
  const narrow = viewWidth < 600;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.textAlign = 'center';

  // Title
  ctx.font = scaledFont(76, true);
  ctx.fillStyle = '#f60';
  ctx.shadowColor = '#f60';
  ctx.shadowBlur = 36;
  ctx.fillText('SPIDER ATTACK', cx, titleY);

  // Tagline
  ctx.font = panelFont(narrow ? 14 : 20, false);
  ctx.fillStyle = '#f99';
  ctx.shadowBlur = 8;
  ctx.fillText(narrow ? 'Survive 10 waves of spiders!' : 'Spiders are swarming from deep space. Survive 10 waves!', cx, taglineY);

  // Divider
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 280 * s, dividerY);
  ctx.lineTo(cx + 280 * s, dividerY);
  ctx.stroke();

  // Instructions header
  ctx.font = panelFont(16, true);
  ctx.fillStyle = '#aef';
  ctx.fillText('HOW TO PLAY', cx, howToY);

  // Instruction rows
  const rows = isMobile ? [
    ['AIM',    'Tap near spiders to hit them'],
    ['SHOOT',  'Tap to fire (10 bullets per clip)'],
    ['MISS',   'Misses add extra shot delay'],
    ['RELOAD', 'Tap the reload button'],
    ['HEALTH', 'Close spiders drain your health'],
    ['SCORE',  'Smaller spiders = more points'],
    ['WIN',    'Survive all 10 waves'],
  ] : [
    ['AIM',    'Move your mouse to track spiders'],
    ['SHOOT',  'Left-click to fire (10 bullets per clip)'],
    ['MISS',   'Misses add a brief shot delay'],
    ['RELOAD', 'Right-click to reload (takes 1 second)'],
    ['HEALTH', 'Close spiders drain your health'],
    ['SCORE',  'Smaller spiders = more points. Hit streaks = combo bonus'],
    ['WIN',    'Destroy every spider across all 10 waves'],
  ];

  let rowY = rowsStartY;
  if (narrow) {
    // Single-column centered layout for narrow screens
    ctx.textAlign = 'center';
    for (const [label, desc] of rows) {
      ctx.font = panelFont(13, true);
      ctx.fillStyle = '#ff0';
      ctx.shadowColor = '#f80';
      ctx.shadowBlur = 4;
      ctx.fillText(`${label}: ${desc}`, cx, rowY);
      ctx.shadowBlur = 0;
      rowY += rowStepSingle;
    }
  } else {
    // Two-column layout for wide screens
    ctx.textAlign = 'left';
    const colX = cx - 260 * s;
    const valX = cx - 120 * s;
    for (const [label, desc] of rows) {
      ctx.font = panelFont(14, true);
      ctx.fillStyle = '#ff0';
      ctx.shadowColor = '#f80';
      ctx.shadowBlur = 4;
      ctx.fillText(label, colX, rowY);

      ctx.font = panelFont(14, false);
      ctx.fillStyle = '#ccc';
      ctx.shadowBlur = 0;
      ctx.fillText(desc, valX, rowY);
      rowY += rowStepDouble;
    }
  }

  // Start prompt
  ctx.textAlign = 'center';
  ctx.font = panelFont(22, true);
  ctx.fillStyle = '#0f0';
  ctx.shadowColor = '#0f0';
  ctx.shadowBlur = 14;
  const promptY = Math.min(viewHeight - promptBottomPad, rowY + promptGap);
  ctx.fillText(isMobile ? '[ TAP TO START ]' : '[ CLICK TO START ]', cx, promptY);

  ctx.restore();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function loop(now) {
  const dt = Math.min(now - (state.lastTime || now), 50);
  state.lastTime = now;
  const healthBefore = state.health;
  canvas.style.cursor = state.phase === 'playing' ? 'none' : 'default';

  ctx.clearRect(0, 0, viewWidth, viewHeight);

  // Background
  ctx.fillStyle = '#000005';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  updateStars(dt);
  drawStars();

  if (state.phase === 'start') {
    drawStartScreen();
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'gameover') {
    drawScreen('GAME OVER', '#f00');
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'victory') {
    drawScreen('VICTORY!', '#0f8');
    requestAnimationFrame(loop);
    return;
  }

  // Playing
  updateReload(now);
  updateWave(dt, now);

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
    sp.draw(ctx);
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

  drawShot();
  drawHUD();
  drawWaveTransition();
  drawCrosshair(state.mouseX, state.mouseY);

  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initState();
requestAnimationFrame(loop);
