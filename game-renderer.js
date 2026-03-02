// Renderer for HUD, overlays, and transient VFX.
// Game state/data is passed in explicitly to keep orchestration in game.js.

export function createRenderer({ ctx, isMobile, MAX_BULLETS, WAVE_DATA, getViewSize, getUiScale }) {
  function scaledFont(size, bold, minPx = 0) {
    const px = Math.max(minPx, Math.round(size * getUiScale()));
    return `${bold ? 'bold ' : ''}${px}px monospace`;
  }

  function drawCrosshair(state) {
    const { viewWidth, viewHeight } = getViewSize();
    if (state.phase !== 'playing') return;
    if (state.mouseX < 0 || state.mouseY < 0 || state.mouseX > viewWidth || state.mouseY > viewHeight) return;
    const x = state.mouseX;
    const y = state.mouseY;
    const size = 18;
    const gap = 5;
    ctx.save();
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + size);
    ctx.moveTo(x + gap + 1, y);
    ctx.arc(x, y, gap + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHUD(state) {
    const s = getUiScale();
    const { viewWidth, viewHeight } = getViewSize();
    const pad = Math.round(20 * s);
    let reloadBtnBounds = null;
    ctx.save();

    ctx.font = scaledFont(22, true);
    ctx.fillStyle = '#aef';
    ctx.shadowColor = '#0af';
    ctx.shadowBlur = 8;
    ctx.fillText(`WAVE ${state.wave + 1} / ${WAVE_DATA.length}`, pad, pad + 22 * s);

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

    const scoreText = `SCORE: ${state.score.toLocaleString()}`;
    ctx.textAlign = 'right';
    ctx.font = scaledFont(22, true);
    ctx.fillStyle = '#aef';
    ctx.shadowColor = '#0af';
    ctx.shadowBlur = 8;
    ctx.fillText(scoreText, viewWidth - pad, pad + 22 * s);

    if (state.comboMultiplier > 1) {
      ctx.font = scaledFont(18, true);
      ctx.fillStyle = '#ff0';
      ctx.shadowColor = '#f80';
      ctx.fillText(`×${state.comboMultiplier} COMBO!`, viewWidth - pad, pad + 48 * s);
    }

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

    if (isMobile) {
      const btnR = Math.round(50 * s);
      const iconR = Math.round(21 * s);
      const btnLift = Math.max(Math.round(52 * s), 30);
      const btnX = viewWidth - pad - btnR;
      const btnY = viewHeight - pad - btnR - btnLift;
      reloadBtnBounds = { x: btnX, y: btnY, r: btnR + 22 };
      const needsReload = state.bullets <= 0 && !state.reloading;
      const blinkOn = needsReload ? (Math.floor(performance.now() / 180) % 2 === 0) : false;
      const alertCol = blinkOn ? '#ff2222' : '#00ff66';
      const ringCol = state.reloading ? '#0f0' : needsReload ? alertCol : '#666';
      const iconCol = state.reloading ? '#0f0' : needsReload ? alertCol : '#aaa';

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

      ctx.beginPath();
      ctx.arc(btnX, btnY, iconR, -Math.PI * 0.8, Math.PI * 0.5);
      ctx.strokeStyle = iconCol;
      ctx.lineWidth = 3;
      ctx.shadowColor = state.reloading || needsReload ? iconCol : 'transparent';
      ctx.shadowBlur = state.reloading || needsReload ? 8 : 0;
      ctx.stroke();

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

      ctx.font = scaledFont(22, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#aef';
      ctx.shadowColor = state.reloading ? '#0f0' : '#0af';
      ctx.shadowBlur = state.reloading ? 8 : 6;
      ctx.fillText('RELOAD', btnX, btnY + btnR + Math.max(Math.round(30 * s), 20));
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    return { reloadBtnBounds };
  }

  function drawShot(state) {
    if (!state.shotFired) return;
    const { x, y, dx, dy, alpha } = state.shotFired;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(dy, dx));

    const streakGrad = ctx.createLinearGradient(0, 0, 52, 0);
    streakGrad.addColorStop(0, 'rgba(210,235,255,1)');
    streakGrad.addColorStop(0.38, 'rgba(85,170,255,0.95)');
    streakGrad.addColorStop(1, 'rgba(35,120,255,0)');
    ctx.fillStyle = streakGrad;
    ctx.fillRect(-3.5, -2.8, 55, 5.6);

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

  function drawScreen(state, title, color) {
    const s = getUiScale();
    const { viewWidth, viewHeight } = getViewSize();
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
    const accuracy = state.shotsFired > 0 ? Math.round((state.totalKills / state.shotsFired) * 100) : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.textAlign = 'center';
    ctx.font = scaledFont(72, true);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.fillText(title, cx, titleY);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 220 * s, topDividerY);
    ctx.lineTo(cx + 220 * s, topDividerY);
    ctx.stroke();

    const stats = [
      ['WAVE', `${state.wave + 1} / ${WAVE_DATA.length}`],
      ['KILLS', state.totalKills.toString()],
      ['SHOTS', state.shotsFired.toString()],
      ['ACCURACY', `${accuracy}%`],
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

    rowY += dividerBeforeGap;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(colX, rowY);
    ctx.lineTo(valX + 120 * s, rowY);
    ctx.stroke();
    rowY += dividerAfterGap;

    const breakdown = [
      ['KILL PTS', state.killScore.toLocaleString()],
      ['COMBO BONUS', `+${state.comboBonus.toLocaleString()}`],
      ['WAVE BONUS', `+${state.waveBonuses.toLocaleString()}`],
    ];
    for (const [label, val] of breakdown) {
      ctx.font = panelFont(16, false);
      ctx.fillStyle = '#aaa';
      ctx.shadowBlur = 0;
      ctx.fillText(label, colX, rowY);
      ctx.fillText(val, valX, rowY);
      rowY += breakdownStep;
    }

    rowY += 4 * s;
    ctx.font = panelFont(22, true);
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#f80';
    ctx.shadowBlur = 8;
    ctx.fillText('TOTAL', colX, rowY);
    ctx.fillText(state.score.toLocaleString(), valX, rowY);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    rowY += buttonGap;
    ctx.font = panelFont(22, true);
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 14;
    const btnText = '[ PLAY AGAIN ]';
    const btnW = ctx.measureText(btnText).width;
    const playAgainBounds = { x: cx - btnW / 2 - 10, y: rowY - buttonBoxH * 0.65, w: btnW + 20, h: buttonBoxH };
    ctx.fillText(btnText, cx, rowY);
    ctx.restore();
    return { playAgainBounds };
  }

  function drawWaveTransition(state) {
    if (!state.waveTransition) return;
    const s = getUiScale();
    const { viewWidth, viewHeight } = getViewSize();
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
    ctx.fillText('Get ready!', viewWidth / 2, viewHeight / 2 + 50 * s);
    ctx.restore();
  }

  function drawStartScreen(state) {
    const s = getUiScale();
    const { viewWidth, viewHeight } = getViewSize();
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
    ctx.font = scaledFont(76, true);
    ctx.fillStyle = '#f60';
    ctx.shadowColor = '#f60';
    ctx.shadowBlur = 36;
    ctx.fillText('SPIDER ATTACK', cx, titleY);

    ctx.font = panelFont(narrow ? 14 : 20, false);
    ctx.fillStyle = '#f99';
    ctx.shadowBlur = 8;
    ctx.fillText(
      narrow ? 'Survive 10 waves of spiders!' : 'Spiders are swarming from deep space. Survive 10 waves!',
      cx,
      taglineY
    );

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 280 * s, dividerY);
    ctx.lineTo(cx + 280 * s, dividerY);
    ctx.stroke();

    ctx.font = panelFont(16, true);
    ctx.fillStyle = '#aef';
    ctx.fillText('HOW TO PLAY', cx, howToY);

    const rows = isMobile ? [
      ['AIM', 'Tap near spiders to hit them'],
      ['SHOOT', 'Tap to fire (10 bullets per clip)'],
      ['MISS', 'Misses add extra shot delay'],
      ['RELOAD', 'Tap the reload button'],
      ['HEALTH', 'Close spiders drain your health'],
      ['SCORE', 'Smaller spiders = more points'],
      ['WIN', 'Survive all 10 waves'],
    ] : [
      ['AIM', 'Move your mouse to track spiders'],
      ['SHOOT', 'Left-click to fire (10 bullets per clip)'],
      ['MISS', 'Misses add a brief shot delay'],
      ['RELOAD', 'Right-click to reload (takes 1 second)'],
      ['HEALTH', 'Close spiders drain your health'],
      ['SCORE', 'Smaller spiders = more points. Hit streaks = combo bonus'],
      ['WIN', 'Destroy every spider across all 10 waves'],
    ];

    let rowY = rowsStartY;
    if (narrow) {
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

    ctx.textAlign = 'center';
    ctx.font = panelFont(22, true);
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 14;
    const promptY = Math.min(viewHeight - promptBottomPad, rowY + promptGap);
    ctx.fillText(isMobile ? '[ TAP TO START ]' : '[ CLICK TO START ]', cx, promptY);
    ctx.restore();
  }

  return {
    drawCrosshair,
    drawHUD,
    drawShot,
    drawScreen,
    drawWaveTransition,
    drawStartScreen,
  };
}
