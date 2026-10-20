/*
 * Sound effects synthesised with the Web Audio API (no audio files).
 * Browsers keep an AudioContext suspended until a user gesture, so the context is created lazily
 * and resumed by unlock(), which the UI calls from key and click handlers.
 */
(function (root) {
  const GS = (root.GhostSnake = root.GhostSnake || {});

  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try {
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.25;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch (e) {
      return false;
    }
  }

  /** One oscillator note with a frequency glide and a quick attack/decay envelope. */
  function tone(opts) {
    const t0 = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.from, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.volume || 0.6, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.02);
  }

  const SOUNDS = {
    food: function () {
      tone({ from: 520, to: 880, duration: 0.09, type: 'square', volume: 0.4 });
    },
    power: function () {
      [330, 440, 554, 740, 880].forEach(function (f, i) {
        tone({ from: f, to: f * 1.02, duration: 0.11, delay: i * 0.07, type: 'triangle', volume: 0.7 });
      });
    },
    ghost: function () {
      tone({ from: 200, to: 1200, duration: 0.22, type: 'sawtooth', volume: 0.35 });
      tone({ from: 1200, to: 600, duration: 0.12, delay: 0.22, type: 'square', volume: 0.3 });
    },
    die: function () {
      tone({ from: 440, to: 55, duration: 0.8, type: 'sawtooth', volume: 0.6 });
      tone({ from: 220, to: 40, duration: 0.9, delay: 0.1, type: 'square', volume: 0.3 });
    },
  };

  function play(name) {
    if (muted || !SOUNDS[name]) return;
    if (!ctx && !unlock()) return;
    if (ctx.state === 'suspended') {
      // Still locked (no gesture yet): drop the sound rather than queueing a burst of stale ones.
      ctx.resume();
      return;
    }
    SOUNDS[name]();
  }

  function setMuted(value) {
    muted = !!value;
    if (master) master.gain.value = muted ? 0 : 0.25;
  }

  function isMuted() {
    return muted;
  }

  GS.Audio = { unlock, play, setMuted, isMuted };
})(globalThis);
