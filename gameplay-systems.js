// Core gameplay systems: combo, shooting, reload, and wave progression.

export function createGameplaySystems({
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
  getViewSize,
}) {
  function updateCombo(state, hit) {
    if (hit) {
      state.combo++;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      state.comboMultiplier = getComboMultiplier(state.combo);
    } else {
      state.combo = 0;
      state.comboMultiplier = 1;
    }
  }

  function shoot(state, mx, my) {
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

    const { viewWidth, viewHeight } = getViewSize();
    const cx = viewWidth / 2;
    const cy = viewHeight / 2;
    const vx = mx - cx;
    const vy = my - cy;
    const len = Math.hypot(vx, vy) || 1;
    state.shotFired = { x: mx, y: my, dx: vx / len, dy: vy / len, alpha: 1 };

    let hit = false;
    for (let i = state.spiders.length - 1; i >= 0; i--) {
      const sp = state.spiders[i];
      if (now - sp.spawnTime < SPAWN_GRACE_MS) continue;
      const pos = sp.getScreenPos(viewWidth, viewHeight);
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
        break;
      }
    }

    if (!hit) {
      state.nextShotTime = now + MISS_SHOT_COOLDOWN;
    }
    updateCombo(state, hit);
  }

  function startReload(state) {
    if (state.reloading) return;
    if (state.bullets >= MAX_BULLETS) return;
    state.reloading = true;
    state.reloadStart = performance.now();
    state.reloadProgress = 0;
    sfxReload();
  }

  function updateReload(state, now) {
    if (!state.reloading) return;
    state.reloadProgress = Math.min(1, (now - state.reloadStart) / RELOAD_TIME);
    if (state.reloadProgress >= 1) {
      state.bullets = MAX_BULLETS;
      state.reloading = false;
    }
  }

  function startWave(state, waveIndex) {
    state.wave = waveIndex;
    state.waveSpawned = 0;
    state.waveKilled = 0;
    state.lastSpawnTime = performance.now();
    state.waveTransition = true;
    state.waveTransitionTimer = 2200;
  }

  function startGame(state) {
    state.phase = 'playing';
    startWave(state, 0);
  }

  function updateWave(state, dt, now) {
    const waveData = WAVE_DATA[state.wave];
    const waveFactor = state.wave / (WAVE_DATA.length - 1);
    const spawnInterval = Math.max(
      MIN_SPAWN_INTERVAL,
      BASE_SPAWN_INTERVAL * (1 - waveFactor * 0.45)
    );

    if (state.waveTransition) {
      state.waveTransitionTimer -= dt;
      if (state.waveTransitionTimer <= 0) state.waveTransition = false;
      return;
    }

    if (state.waveSpawned < waveData.spiders && now - state.lastSpawnTime >= spawnInterval) {
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

    if (state.waveKilled >= waveData.spiders && state.spiders.length === 0) {
      state.score += 500;
      state.waveBonuses += 500;
      const nextWave = state.wave + 1;
      if (nextWave >= WAVE_DATA.length) {
        state.phase = 'victory';
      } else {
        startWave(state, nextWave);
      }
    }
  }

  return {
    shoot,
    startReload,
    updateReload,
    startGame,
    startWave,
    updateWave,
  };
}
