// Ember Duel — sound (audio.js). Web Audio API only, no audio files: every
// sound is a small oscillator (or filtered noise) built at play time, so the
// game loads with zero network requests and zero audio assets.
// Sounds: click (pick a card), play (card snaps down), hit (damage lands),
// block (a dull wooden thud), heal (a rising chime), win / loss jingles.
// The context is created lazily on the first user gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({ freq = 440, freqEnd = null, dur = 0.12, type = 'sine', gain = 0.15, delay = 0 }) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.15, gain = 0.2, freq = 800, delay = 0 }) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(ac.destination);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    click() { tone({ freq: 660, dur: 0.05, type: 'triangle', gain: 0.1 }); },
    draw() { tone({ freq: 440, freqEnd: 880, dur: 0.09, type: 'sine', gain: 0.08 }); },
    play() { tone({ freq: 520, freqEnd: 260, dur: 0.1, type: 'triangle', gain: 0.14 }); noise({ dur: 0.06, gain: 0.08, freq: 2400 }); },
    hit() { noise({ dur: 0.18, gain: 0.25, freq: 700 }); tone({ freq: 160, freqEnd: 60, dur: 0.18, type: 'sawtooth', gain: 0.16 }); },
    block() { tone({ freq: 220, freqEnd: 140, dur: 0.12, type: 'square', gain: 0.1 }); },
    heal() { tone({ freq: 523, dur: 0.12, type: 'sine', gain: 0.12 }); tone({ freq: 784, dur: 0.16, type: 'sine', gain: 0.12, delay: 0.09 }); },
    burn() { noise({ dur: 0.3, gain: 0.12, freq: 1400 }); tone({ freq: 330, freqEnd: 220, dur: 0.25, type: 'sawtooth', gain: 0.07 }); },
    turn() { tone({ freq: 392, dur: 0.07, type: 'triangle', gain: 0.09 }); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.14, delay: i * 0.12 }));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'sine', gain: 0.13, delay: i * 0.16 }));
    },
  };
}
