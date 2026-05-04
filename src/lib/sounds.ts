/**
 * Child-friendly sound effects using Web Audio API.
 * No external files — all generated with oscillators.
 */

function ctx() {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

function note(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.3,
  type: OscillatorType = 'triangle',
  endFreq?: number
) {
  const osc  = ac.createOscillator();
  const g    = ac.createGain();
  osc.connect(g);
  g.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + start + dur);
  }
  g.gain.setValueAtTime(gain, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur);
}

function close(ac: AudioContext, after = 2000) {
  setTimeout(() => ac.close().catch(() => {}), after);
}

/** 🎉 Fanfare — perfect / excellent answer */
export function playFanfare() {
  try {
    const ac = ctx();
    note(ac, 523,  0.00, 0.12, 0.4, 'triangle');  // C5
    note(ac, 659,  0.13, 0.12, 0.4, 'triangle');  // E5
    note(ac, 784,  0.26, 0.12, 0.4, 'triangle');  // G5
    note(ac, 1047, 0.39, 0.35, 0.5, 'triangle');  // C6 held
    note(ac, 1319, 0.44, 0.30, 0.25, 'sine');      // E6 harmony
    // sparkle shimmer
    note(ac, 2093, 0.50, 0.07, 0.15, 'sine');
    note(ac, 2637, 0.58, 0.07, 0.12, 'sine');
    note(ac, 2093, 0.66, 0.07, 0.10, 'sine');
    close(ac);
  } catch {}
}

/** ⭐ Cheer — good / correct answer */
export function playCheer() {
  try {
    const ac = ctx();
    note(ac, 523, 0.00, 0.18, 0.35, 'triangle'); // C5
    note(ac, 784, 0.20, 0.25, 0.40, 'triangle'); // G5
    note(ac, 1047, 0.20, 0.25, 0.20, 'sine');    // C6 harmony
    close(ac);
  } catch {}
}

/** 💪 Encourage — try again / poor answer (gentle, not discouraging) */
export function playEncourage() {
  try {
    const ac = ctx();
    note(ac, 440, 0.00, 0.18, 0.22, 'sine'); // A4
    note(ac, 392, 0.20, 0.18, 0.18, 'sine'); // G4
    note(ac, 440, 0.40, 0.22, 0.20, 'sine'); // A4 — ends same note (hopeful)
    close(ac);
  } catch {}
}

/** 🔁 Nudge — wrong answer, try again */
export function playWrong() {
  try {
    const ac = ctx();
    note(ac, 330, 0.00, 0.14, 0.22, 'sawtooth');
    note(ac, 277, 0.16, 0.20, 0.18, 'sawtooth');
    close(ac);
  } catch {}
}

/** 🎮 Coin — quick correct in a game */
export function playCoin() {
  try {
    const ac = ctx();
    note(ac, 987,  0.00, 0.08, 0.30, 'square');
    note(ac, 1319, 0.09, 0.15, 0.25, 'square');
    close(ac);
  } catch {}
}

/** 🏆 Level complete */
export function playLevelComplete() {
  try {
    const ac = ctx();
    // Ascending scale
    [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => {
      note(ac, f, i * 0.10, 0.12, 0.3, 'triangle');
    });
    // Final chord
    note(ac, 1047, 0.85, 0.50, 0.40, 'triangle');
    note(ac, 1319, 0.85, 0.50, 0.25, 'sine');
    note(ac, 1568, 0.85, 0.50, 0.20, 'sine');
    close(ac, 3000);
  } catch {}
}

/** Play the right sound for a 0-100 accuracy score */
export function playForAccuracy(accuracy: number) {
  if (accuracy >= 90)      playFanfare();
  else if (accuracy >= 75) playCheer();
  else if (accuracy >= 50) playEncourage();
  else                     playWrong();
}
