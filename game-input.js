// Input wiring for desktop and mobile.
// Keeps DOM event handling separate from gameplay orchestration.

export function setupInputHandlers({
  canvas,
  audioCtx,
  getState,
  setMouse,
  onStart,
  onRestart,
  onShoot,
  onReload,
  getPlayAgainBounds,
  getReloadBtnBounds,
}) {
  canvas.addEventListener('mousemove', e => {
    setMouse(e.clientX, e.clientY);
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    const state = getState();
    if (e.button === 2) {
      if (state.phase === 'playing') onReload();
      return;
    }
    if (e.button !== 0) return;

    if (state.phase === 'start') {
      onStart();
      return;
    }
    if (state.phase === 'gameover' || state.phase === 'victory') {
      const b = getPlayAgainBounds();
      if (b &&
          e.clientX >= b.x && e.clientX <= b.x + b.w &&
          e.clientY >= b.y && e.clientY <= b.y + b.h) {
        onRestart();
      }
      return;
    }
    if (state.phase === 'playing') {
      onShoot(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('touchstart', e => {
    const state = getState();
    e.preventDefault();
    audioCtx.resume(); // iOS requires user gesture to start audio
    const t = e.touches[0];
    const tx = t.clientX;
    const ty = t.clientY;
    setMouse(tx, ty);

    if (state.phase === 'start') {
      onStart();
      return;
    }
    if (state.phase === 'gameover' || state.phase === 'victory') {
      const b = getPlayAgainBounds();
      if (b &&
          tx >= b.x && tx <= b.x + b.w &&
          ty >= b.y && ty <= b.y + b.h) {
        onRestart();
      }
      return;
    }
    if (state.phase === 'playing') {
      const rb = getReloadBtnBounds();
      if (rb) {
        const dx = tx - rb.x;
        const dy = ty - rb.y;
        if (dx * dx + dy * dy <= rb.r * rb.r) {
          onReload();
          return;
        }
      }
      onShoot(tx, ty);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    setMouse(t.clientX, t.clientY);
  }, { passive: false });
}
