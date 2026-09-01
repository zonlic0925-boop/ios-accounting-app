/**
 * iOS Taptic Engine and Audio Feedback Simulator
 * Uses HTML5 Web Audio API (zero external assets required, low latency) and navigator.vibrate
 */

class HapticsService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Subtle click for keypad numbers and tabs
   */
  public selection() {
    this.vibrate(10);
    this.playTone(180, 0.03, 0.05, "triangle");
  }

  /**
   * Light impact for normal button taps
   */
  public light() {
    this.vibrate(15);
    this.playTone(240, 0.04, 0.08, "sine");
  }

  /**
   * Medium impact for operators +, -, *, /
   */
  public medium() {
    this.vibrate(25);
    this.playTone(320, 0.06, 0.12, "sine");
  }

  /**
   * Heavy impact for confirmation, delete, equals
   */
  public heavy() {
    this.vibrate([20, 30, 20]);
    this.playTone(140, 0.08, 0.15, "triangle");
  }

  /**
   * Success notification
   */
  public success() {
    this.vibrate([15, 50, 20]);
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);
    } catch {
      // Ignore audio failure
    }
  }

  /**
   * Error notification
   */
  public error() {
    this.vibrate([30, 40, 30, 40, 30]);
    this.playTone(110, 0.15, 0.18, "sawtooth");
  }

  private vibrate(pattern: number | number[]) {
    if (!this.enabled) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration failure
      }
    }
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType = "sine") {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio might be blocked by browser policy before first interaction
    }
  }
}

export const haptics = new HapticsService();
