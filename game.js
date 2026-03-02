import { MAX_BULLETS, RELOAD_TIME, BASE_SPAWN_INTERVAL, SPIDER_MAX_RADIUS, WAVE_DATA, scoreForRadius, getComboMultiplier, hitTest } from './game-logic.js';

// ─── Audio ───────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function sfxShoot() {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}

function sfxKill() {
  const t = audioCtx.currentTime + 0.02;

  // Short bright click so it cuts through on mobile speakers.
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(2200, t);
  click.frequency.exponentialRampToValueAtTime(900, t + 0.025);
  clickGain.gain.setValueAtTime(0.09, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  click.connect(clickGain).connect(audioCtx.destination);
  click.start(t);
  click.stop(t + 0.04);

  // Tiny low body underneath the click.
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(180, t);
  body.frequency.exponentialRampToValueAtTime(95, t + 0.055);
  bodyGain.gain.setValueAtTime(0.05, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  body.connect(bodyGain).connect(audioCtx.destination);
  body.start(t);
  body.stop(t + 0.07);

  // Crunch texture in the 1-3 kHz range for audibility.
  const bufLen = Math.floor(audioCtx.sampleRate * 0.06);
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const p = i / bufLen;
    const env = Math.pow(1 - p, 3);
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const crunchNoise = audioCtx.createBufferSource();
  const hp = audioCtx.createBiquadFilter();
  const lp = audioCtx.createBiquadFilter();
  const crunchGain = audioCtx.createGain();
  crunchNoise.buffer = buf;
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(900, t);
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t);
  crunchGain.gain.setValueAtTime(0.06, t);
  crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
  crunchNoise.connect(hp).connect(lp).connect(crunchGain).connect(audioCtx.destination);
  crunchNoise.start(t);
  crunchNoise.stop(t + 0.06);
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
const HIT_RADIUS = isMobile ? 55 : 40; // px — larger on mobile for finger taps
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
    shotFired: null,   // { x, y, tx, ty, alpha }
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
    mouseX: viewWidth / 2,
    mouseY: viewHeight / 2,
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
    s.sr = Math.max(0.5, scale * 2.5);
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
  constructor(angle, speed, weave) {
    this.angle = angle;
    this.speed = speed;
    this.weave = weave || false;
    this.progress = 0;
    this.weaveOffset = Math.random() * Math.PI * 2;
    this.weaveAmp = 0.03 + Math.random() * 0.04;
    this.weaveFreq = 1.5 + Math.random();
    // Small center jitter so waves don't stack perfectly on one origin point.
    this.originOffsetX = (Math.random() - 0.5) * 60;
    this.originOffsetY = (Math.random() - 0.5) * 60;
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
  if (state.reloading) return;
  if (state.waveTransition) return;

  if (state.bullets <= 0) {
    state.reloadWarningFlash = 800;
    return;
  }

  state.bullets--;
  state.shotsFired++;
  sfxShoot();

  // Record shot for visual
  state.shotFired = { x: mx, y: my, alpha: 1 };

  // Hit detection
  let hit = false;
  for (let i = state.spiders.length - 1; i >= 0; i--) {
    const sp = state.spiders[i];
    const pos = sp.screenPos;
    if (hitTest(mx, my, pos.x, pos.y, HIT_RADIUS, sp.radius)) {
      const base = scoreForRadius(sp.radius);
      const pts = Math.round(base * state.comboMultiplier);
      state.score += pts;
      state.killScore += base;
      state.comboBonus += pts - base;
      state.deathEffects.push({ x: pos.x, y: pos.y, r: sp.radius, t: 0 });
      state.spiders.splice(i, 1);
      state.waveKilled++;
      state.totalKills++;
      hit = true;
      sfxKill();
      break; // one bullet, one spider
    }
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

  if (state.waveTransition) {
    state.waveTransitionTimer -= dt;
    if (state.waveTransitionTimer <= 0) state.waveTransition = false;
    return;
  }

  // Spawn spiders — initial burst then steady stream
  if (state.waveSpawned < waveData.spiders && now - state.lastSpawnTime >= BASE_SPAWN_INTERVAL) {
    // Spawn 2-3 at once early in the wave, then 1 at a time
    const batch = state.waveSpawned < 4 ? 3 : 1;
    for (let b = 0; b < batch && state.waveSpawned < waveData.spiders; b++) {
      const angle = Math.random() * Math.PI * 2;
      state.spiders.push(new Spider(angle, waveData.speed, waveData.weave));
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

  // Reload warning flash
  if (state.reloadWarningFlash > 0) {
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
    const btnR = Math.round(42 * s);
    const iconR = Math.round(18 * s);
    const btnX = viewWidth - pad - btnR;
    const btnY = viewHeight - pad - btnR;
    reloadBtnBounds = { x: btnX, y: btnY, r: btnR + 14 }; // extra tap forgiveness on mobile

    // Button background
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
    ctx.fillStyle = state.reloading ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = state.reloading ? '#0f0' : '#666';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Circular arrow icon
    ctx.beginPath();
    ctx.arc(btnX, btnY, iconR, -Math.PI * 0.8, Math.PI * 0.5);
    ctx.strokeStyle = state.reloading ? '#0f0' : '#aaa';
    ctx.lineWidth = 3;
    ctx.shadowColor = state.reloading ? '#0f0' : 'transparent';
    ctx.shadowBlur = state.reloading ? 8 : 0;
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
    ctx.strokeStyle = state.reloading ? '#0f0' : '#aaa';
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
  }

  ctx.restore();
}

function drawShot() {
  if (!state.shotFired) return;
  const { x, y, alpha } = state.shotFired;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Outer glow
  const grad = ctx.createRadialGradient(x, y, 0, x, y, 70 * alpha);
  grad.addColorStop(0, 'rgba(255,200,50,0.9)');
  grad.addColorStop(0.3, 'rgba(255,120,20,0.5)');
  grad.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 70 * alpha, 0, Math.PI * 2);
  ctx.fill();

  // Bright core
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 14 * alpha, 0, Math.PI * 2);
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
  const buttonGap = isMobile ? Math.max(50 * s, 42) : 50 * s;
  const buttonBoxH = isMobile ? Math.max(34 * s, 32) : 34 * s;
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
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
  ctx.fillText(title, cx, cy - 130 * s);

  // Divider
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 220 * s, cy - 100 * s);
  ctx.lineTo(cx + 220 * s, cy - 100 * s);
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
  let rowY = cy - 75 * s;
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
  rowY += isMobile ? Math.max(8 * s, 8) : 8 * s;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(colX, rowY);
  ctx.lineTo(valX + 120 * s, rowY);
  ctx.stroke();
  rowY += sectionGap;

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
  const promptY = isMobile ? Math.max(145 * s, 165) : 145 * s;
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
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
  ctx.fillText('SPIDER ATTACK', cx, cy - 170 * s);

  // Tagline
  ctx.font = panelFont(narrow ? 14 : 20, false);
  ctx.fillStyle = '#f99';
  ctx.shadowBlur = 8;
  ctx.fillText(narrow ? 'Survive 10 waves of spiders!' : 'Spiders are swarming from deep space. Survive 10 waves!', cx, cy - 120 * s);

  // Divider
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 280 * s, cy - 92 * s);
  ctx.lineTo(cx + 280 * s, cy - 92 * s);
  ctx.stroke();

  // Instructions header
  ctx.font = panelFont(16, true);
  ctx.fillStyle = '#aef';
  ctx.fillText('HOW TO PLAY', cx, cy - 65 * s);

  // Instruction rows
  const rows = isMobile ? [
    ['AIM',    'Tap where spiders appear'],
    ['SHOOT',  'Tap to fire (10 per clip)'],
    ['RELOAD', 'Tap reload button'],
    ['HEALTH', 'Spiders drain your health'],
    ['SCORE',  'Small spiders = more points'],
    ['WIN',    'Survive all 10 waves'],
  ] : [
    ['AIM',    'Move your mouse — crosshair tracks your cursor'],
    ['SHOOT',  'Left-click to fire (10 bullets per clip)'],
    ['RELOAD', 'Right-click to reload (takes 1 second)'],
    ['HEALTH', 'Close spiders drain your health. If it hits 0 — game over!'],
    ['SCORE',  'Smaller spiders = more points. Hit streaks = combo bonus'],
    ['WIN',    'Destroy every spider across all 10 waves'],
  ];

  let rowY = cy - 30 * s;
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
  ctx.fillText(isMobile ? '[ TAP TO START ]' : '[ CLICK TO START ]', cx, cy + promptY);

  ctx.restore();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function loop(now) {
  const dt = Math.min(now - (state.lastTime || now), 50);
  state.lastTime = now;

  ctx.clearRect(0, 0, viewWidth, viewHeight);

  // Background
  ctx.fillStyle = '#000005';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  updateStars(dt);
  drawStars();

  if (state.phase === 'start') {
    drawStartScreen();
    drawCrosshair(state.mouseX, state.mouseY);
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'gameover') {
    drawScreen('GAME OVER', '#f00');
    drawCrosshair(state.mouseX, state.mouseY);
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'victory') {
    drawScreen('VICTORY!', '#0f8');
    drawCrosshair(state.mouseX, state.mouseY);
    requestAnimationFrame(loop);
    return;
  }

  // Playing
  updateReload(now);
  updateWave(dt, now);

  if (state.reloadWarningFlash > 0) state.reloadWarningFlash -= dt;

  // Update shot alpha
  if (state.shotFired) {
    state.shotFired.alpha -= dt * 0.012;
    if (state.shotFired.alpha <= 0) state.shotFired = null;
  }

  // Update spiders
  for (let i = state.spiders.length - 1; i >= 0; i--) {
    const sp = state.spiders[i];
    sp.update(dt);

    if (sp.progress >= 1.0) {
      // Spider reached player — bites for a chunk of health, then gone
      state.health = Math.max(0, state.health - 10);
      state.damageFlash = 500;
      state.waveKilled++;
      state.spiders.splice(i, 1);
    } else if (sp.progress > 0.65) {
      // Spider very close — gnawing continuously
      const intensity = (sp.progress - 0.65) / 0.35;
      state.health = Math.max(0, state.health - intensity * 8 * dt * 0.001);
      state.damageFlash = Math.max(state.damageFlash, intensity * 300);
    }
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
    fx.t += dt * 0.004;
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

  drawShot();
  drawHUD();
  drawWaveTransition();
  drawCrosshair(state.mouseX, state.mouseY);

  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initState();
requestAnimationFrame(loop);
