// Audio subsystem for Spider Attack.
// Keeps all Web Audio setup and SFX envelopes in one place.

export function createAudio(isMobile) {
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

  return {
    audioCtx,
    sfxShoot,
    sfxKill,
    sfxReload,
    sfxDamage,
  };
}
