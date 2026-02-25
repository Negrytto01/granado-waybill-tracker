const audioCtx = () => new (window.AudioContext || (window as any).webkitAudioContext)();

const playTone = (frequency: number, duration: number, type: OscillatorType = "sine") => {
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Sound not supported", e);
  }
};

export const playTruckArrival = () => {
  playTone(880, 0.15, "square");
  setTimeout(() => playTone(1100, 0.15, "square"), 150);
  setTimeout(() => playTone(1320, 0.3, "square"), 300);
};

export const playDescargaFinalizada = () => {
  playTone(523, 0.2, "sine");
  setTimeout(() => playTone(659, 0.2, "sine"), 200);
  setTimeout(() => playTone(784, 0.4, "sine"), 400);
};

export const playNotification = () => {
  playTone(660, 0.1, "triangle");
  setTimeout(() => playTone(880, 0.2, "triangle"), 120);
};
