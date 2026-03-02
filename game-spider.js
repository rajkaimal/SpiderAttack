import { SPIDER_MAX_RADIUS } from './game-logic.js';

export class Spider {
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

  getScreenPos(viewWidth, viewHeight) {
    const cx = viewWidth / 2 + this.originOffsetX;
    const cy = viewHeight / 2 + this.originOffsetY;
    const maxDist = Math.min(viewWidth, viewHeight) * 0.44;
    const dist = this.progress * maxDist;
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

  draw(ctx, viewWidth, viewHeight, now = performance.now()) {
    const { x, y } = this.getScreenPos(viewWidth, viewHeight);
    const r = this.radius;
    const alpha = Math.min(1, this.progress * 10);
    const px = Math.max(1, Math.round(r / 10));
    const walk = Math.sin(now * 0.005 + this.weaveOffset);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));

    const P = (gx, gy, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(gx * px), Math.round(gy * px), px, px);
    };

    const line = (x0, y0, x1, y1, col, out) => {
      [x0, y0, x1, y1] = [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
      let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
      for (;;) {
        if (out) {
          ctx.fillStyle = out;
          ctx.fillRect(Math.round(x0 * px) - 1, Math.round(y0 * px) - 1, px + 2, px + 2);
        }
        P(x0, y0, col);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    };

    const leg = (ax, ay, kx, ky, tx, ty) => {
      line(ax, ay, kx, ky, '#3c1c0a', '#100600');
      line(kx, ky, tx, ty, '#2c1006', '#100600');
      P(kx, ky, '#8a4020');
    };

    const phA = walk * 1.3, phB = -walk * 1.3;

    // ── LEGS — front-facing: body on top, ALL tips reach DOWNWARD ──
    for (const s of [-1, 1]) {
      leg(s * 3, -3, s * 7, -7 + phA, s * 12, 0 + phA * 0.5);
      leg(s * 4, -1, s * 9, -2 + phB, s * 13, 4 + phB * 0.4);
      leg(s * 4, 1, s * 9, 4 + phB, s * 12, 8 + phB * 0.4);
      leg(s * 3, 2, s * 7, 8 + phA, s * 10, 12 + phA * 0.5);
    }

    // ── ABDOMEN ─────────────────────────────────────────────
    for (const [gy, hw] of [
      [2, 2], [3, 3], [4, 4], [5, 5], [6, 5], [7, 4], [8, 3], [9, 2], [10, 1],
    ]) {
      for (let gx = -hw; gx <= hw; gx++) {
        const edge = Math.abs(gx) === hw;
        const hi = !edge && gy >= 4 && gy <= 6 && Math.abs(gx) <= 2;
        P(gx, gy, edge ? '#2c1400' : hi ? '#6a2a10' : '#4a1c08');
      }
    }

    P(-1, 1, '#2a1206'); P(0, 1, '#3a1808'); P(1, 1, '#2a1206');

    // ── CEPHALOTHORAX ───────────────────────────────────────
    for (const [gy, hw] of [
      [-6, 1], [-5, 2], [-4, 3], [-3, 3], [-2, 3], [-1, 2], [0, 1],
    ]) {
      for (let gx = -hw; gx <= hw; gx++) {
        const edge = Math.abs(gx) === hw;
        const hi = !edge && gy >= -5 && gy <= -2 && Math.abs(gx) <= 1;
        P(gx, gy, edge ? '#3a1800' : hi ? '#c85020' : '#9a3818');
      }
    }

    P(-1, 0, '#5a2010'); P(1, 0, '#5a2010');
    P(-2, -5, '#ffffff'); P(-1, -5, '#ffffff');
    P(1, -5, '#ffffff'); P(2, -5, '#ffffff');
    P(-2, -4, '#cc1100'); P(-1, -4, '#cc1100');
    P(1, -4, '#cc1100'); P(2, -4, '#cc1100');
    P(-1, -4, '#110000'); P(1, -4, '#110000');

    ctx.restore();
  }
}
