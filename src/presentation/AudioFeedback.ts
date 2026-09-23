export type FeedbackSound = 'build' | 'night' | 'ability' | 'explore' | 'damage' | 'victory' | 'defeat';

const SOUND: Record<FeedbackSound, { frequency: number; endFrequency: number; duration: number; type: OscillatorType }> = {
  build: { frequency: 330, endFrequency: 520, duration: 0.12, type: 'square' },
  night: { frequency: 150, endFrequency: 70, duration: 0.55, type: 'sawtooth' },
  ability: { frequency: 240, endFrequency: 620, duration: 0.35, type: 'triangle' },
  explore: { frequency: 420, endFrequency: 680, duration: 0.18, type: 'sine' },
  damage: { frequency: 110, endFrequency: 75, duration: 0.09, type: 'square' },
  victory: { frequency: 440, endFrequency: 880, duration: 0.65, type: 'triangle' },
  defeat: { frequency: 220, endFrequency: 65, duration: 0.7, type: 'sawtooth' },
};

export class AudioFeedback {
  private context: AudioContext | null = null;

  constructor(private readonly volume: () => number) {}

  play(sound: FeedbackSound): void {
    const volume = this.volume();
    if (volume <= 0) {
      return;
    }
    try {
      this.context ??= new AudioContext();
      const context = this.context;
      const definition = SOUND[sound];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = definition.type;
      oscillator.frequency.setValueAtTime(definition.frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(definition.endFrequency, now + definition.duration);
      gain.gain.setValueAtTime(Math.min(0.12, volume * 0.12), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + definition.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + definition.duration);
    } catch {
      return;
    }
  }
}
