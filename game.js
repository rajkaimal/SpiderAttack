// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_BULLETS = 10;
const RELOAD_TIME = 1000; // ms
const HIT_RADIUS = 40;    // px — click detection radius
const STAR_COUNT = 150;
const SPIDER_MIN_RADIUS = 8;
const SPIDER_MAX_RADIUS = 110;
const BASE_SPAWN_INTERVAL = 500; // ms — baseline, adaptive system adjusts this

const WAVE_DATA = [
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

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
    mouseX: canvas.width / 2,
    mouseY: canvas.height / 2,
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
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * Math.max(canvas.width, canvas.height) * 0.6;
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    z: Math.random(),  // 0=far, 1=near
    brightness: 0.4 + Math.random() * 0.6,
  };
}

function updateStars(dt) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
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
    if (!s.sx) continue;
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
    // Random offset from center so spiders don't all converge on one point
    this.originOffsetX = (Math.random() - 0.5) * 160;
    this.originOffsetY = (Math.random() - 0.5) * 160;
  }

  get radius() {
    const t = Math.pow(this.progress, 0.55);
    return SPIDER_MIN_RADIUS + t * (SPIDER_MAX_RADIUS - SPIDER_MIN_RADIUS);
  }

  get screenPos() {
    const cx = canvas.width / 2 + this.originOffsetX;
    const cy = canvas.height / 2 + this.originOffsetY;
    const expansion = Math.pow(this.progress, 1.2);
    const maxDist = Math.min(canvas.width, canvas.height) * 0.44;
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
    P(-1,-5,'#110000'); P(1,-5,'#110000');    // dark pupils

    ctx.restore();
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function scoreForRadius(r) {
  if (r < 25) return 150;
  if (r < 50) return 80;
  if (r < 80) return 40;
  return 15;
}

function updateCombo(hit) {
  if (hit) {
    state.combo++;
    if (state.combo >= 5) state.comboMultiplier = 2;
    else if (state.combo >= 3) state.comboMultiplier = 1.5;
    else state.comboMultiplier = 1;
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
    initState();
    state.phase = 'start';
    return;
  }
  if (state.phase === 'playing') {
    shoot(e.clientX, e.clientY);
  }
});

// ─── Shooting ─────────────────────────────────────────────────────────────────
function shoot(mx, my) {
  if (state.reloading) return;
  if (state.waveTransition) return;

  if (state.bullets <= 0) {
    state.reloadWarningFlash = 800;
    return;
  }

  state.bullets--;

  // Record shot for visual
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  state.shotFired = { x: cx, y: cy, tx: mx, ty: my, alpha: 1 };

  // Hit detection
  let hit = false;
  for (let i = state.spiders.length - 1; i >= 0; i--) {
    const sp = state.spiders[i];
    const pos = sp.screenPos;
    const dx = pos.x - mx;
    const dy = pos.y - my;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= Math.max(HIT_RADIUS, sp.radius)) {
      const pts = Math.round(scoreForRadius(sp.radius) * state.comboMultiplier);
      state.score += pts;
      state.spiders.splice(i, 1);
      state.waveKilled++;
      hit = true;
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
  state.wave = 0;
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
  if (state.waveSpawned < waveData.spiders && now - state.lastSpawnTime >= SPAWN_INTERVAL) {
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
    state.score += 500; // wave bonus
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
  ctx.arc(x, y, gap + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  const pad = 20;
  ctx.save();

  // Wave
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#aef';
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 8;
  ctx.fillText(`WAVE ${state.wave + 1} / ${WAVE_DATA.length}`, pad, pad + 22);

  // Health bar
  const hpFrac = Math.max(0, state.health / state.maxHealth);
  const hpBarW = 180;
  const hpBarH = 12;
  const hpX = pad;
  const hpY = pad + 34;
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
  ctx.font = '11px monospace';
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(state.health)}`, hpX + hpBarW + 8, hpY + 10);

  // Score
  const scoreText = `SCORE: ${state.score.toLocaleString()}`;
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#aef';
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 8;
  ctx.fillText(scoreText, canvas.width - pad, pad + 22);

  // Combo
  if (state.comboMultiplier > 1) {
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#f80';
    ctx.fillText(`×${state.comboMultiplier} COMBO!`, canvas.width - pad, pad + 48);
  }

  // Bullets
  ctx.textAlign = 'left';
  ctx.shadowBlur = 0;
  const bulletY = canvas.height - pad - 10;
  const pipR = 8;
  const pipGap = 5;

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

  // Reload arc
  if (state.reloading) {
    const arcX = pad + MAX_BULLETS * (pipR * 2 + pipGap) + 20;
    const arcY = bulletY;
    ctx.beginPath();
    ctx.arc(arcX, arcY, 14, -Math.PI / 2, -Math.PI / 2 + state.reloadProgress * Math.PI * 2);
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.font = '11px monospace';
    ctx.fillStyle = '#0f0';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.fillText('RELOAD', arcX + 20, arcY + 5);
  }

  // Reload warning flash
  if (state.reloadWarningFlash > 0) {
    const alpha = Math.min(1, state.reloadWarningFlash / 400);
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = `rgba(255,50,50,${alpha})`;
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 16;
    ctx.textAlign = 'center';
    ctx.fillText('RELOAD!', canvas.width / 2, canvas.height - 80);
  }

  ctx.restore();
}

function drawShot() {
  if (!state.shotFired) return;
  const { x, y, tx, ty, alpha } = state.shotFired;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ff0';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ff0';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.restore();
}

function drawScreen(title, subtitle, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';

  ctx.font = 'bold 72px monospace';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 60);

  ctx.font = '28px monospace';
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 10;
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#aaa';
  ctx.shadowBlur = 0;
  ctx.fillText('Click to continue', canvas.width / 2, canvas.height / 2 + 60);

  ctx.restore();
}

function drawWaveTransition() {
  if (!state.waveTransition) return;
  const alpha = Math.min(1, state.waveTransitionTimer / 800);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px monospace';
  ctx.fillStyle = '#0af';
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 24;
  ctx.fillText(`WAVE ${state.wave + 1}`, canvas.width / 2, canvas.height / 2);
  ctx.font = '22px monospace';
  ctx.fillStyle = '#aef';
  ctx.shadowBlur = 8;
  ctx.fillText('Get ready!', canvas.width / 2, canvas.height / 2 + 50);
  ctx.restore();
}

function drawStartScreen() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';

  // Title
  ctx.font = 'bold 76px monospace';
  ctx.fillStyle = '#f60';
  ctx.shadowColor = '#f60';
  ctx.shadowBlur = 36;
  ctx.fillText('SPIDER ATTACK', cx, cy - 170);

  // Tagline
  ctx.font = '20px monospace';
  ctx.fillStyle = '#f99';
  ctx.shadowBlur = 8;
  ctx.fillText('Spiders are swarming from deep space. Survive 10 waves!', cx, cy - 120);

  // Divider
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 280, cy - 92);
  ctx.lineTo(cx + 280, cy - 92);
  ctx.stroke();

  // Instructions header
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#aef';
  ctx.fillText('HOW TO PLAY', cx, cy - 65);

  // Instruction rows
  const rows = [
    ['AIM',    'Move your mouse — crosshair tracks your cursor'],
    ['SHOOT',  'Left-click to fire (10 bullets per clip)'],
    ['RELOAD', 'Right-click to reload (takes 1 second)'],
    ['HEALTH', 'Close spiders gnaw your HP. If HP hits 0 — game over!'],
    ['SCORE',  'Smaller spiders = more points. Hit streaks = combo bonus'],
    ['WIN',    'Destroy every spider across all 10 waves'],
  ];

  ctx.textAlign = 'left';
  const colX = cx - 260;
  const valX = cx - 120;
  let rowY = cy - 30;
  for (const [label, desc] of rows) {
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#f80';
    ctx.shadowBlur = 4;
    ctx.fillText(label, colX, rowY);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#ccc';
    ctx.shadowBlur = 0;
    ctx.fillText(desc, valX, rowY);
    rowY += 26;
  }

  // Start prompt
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#0f0';
  ctx.shadowColor = '#0f0';
  ctx.shadowBlur = 14;
  ctx.fillText('[ CLICK TO START ]', cx, cy + 145);

  ctx.restore();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function loop(now) {
  const dt = Math.min(now - (state.lastTime || now), 50);
  state.lastTime = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = '#000005';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  updateStars(dt);
  drawStars();

  if (state.phase === 'start') {
    drawStartScreen();
    drawCrosshair(state.mouseX, state.mouseY);
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'gameover') {
    drawScreen('GAME OVER', `Score: ${state.score.toLocaleString()}  |  Wave ${state.wave + 1}`, '#f00');
    drawCrosshair(state.mouseX, state.mouseY);
    requestAnimationFrame(loop);
    return;
  }

  if (state.phase === 'victory') {
    drawScreen('VICTORY!', `Final Score: ${state.score.toLocaleString()}`, '#0f8');
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
    state.shotFired.alpha -= dt * 0.005;
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
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  if (state.health <= 0) {
    state.phase = 'gameover';
  }

  // Draw spiders (smallest first so large ones render on top)
  state.spiders.sort((a, b) => a.progress - b.progress);
  for (const sp of state.spiders) {
    sp.draw(ctx);
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
