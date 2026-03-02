// Starfield subsystem for Spider Attack.
// Keeps background star generation, movement, and rendering isolated.

function randomStar(viewWidth, viewHeight) {
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * Math.max(viewWidth, viewHeight) * 0.6;
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    z: Math.random(), // 0=far, 1=near
    brightness: 0.4 + Math.random() * 0.6,
  };
}

export function initStars(starCount, viewWidth, viewHeight) {
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push(randomStar(viewWidth, viewHeight));
  }
  return stars;
}

export function updateStars(stars, dt, phase, viewWidth, viewHeight) {
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const speed = phase === 'playing' ? 0.4 : 0.1;

  for (const s of stars) {
    // Move outward from center (stars rushing past).
    const dx = s.x - cx;
    const dy = s.y - cy;
    s.z += dt * speed * 0.001;

    if (s.z >= 1) {
      Object.assign(s, randomStar(viewWidth, viewHeight));
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

export function drawStars(ctx, stars) {
  for (const s of stars) {
    if (s.sx == null) continue;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, s.sr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.salpha})`;
    ctx.fill();
  }
}
