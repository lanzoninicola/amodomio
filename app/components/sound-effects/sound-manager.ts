// hooks/useSound.ts

export interface SoundOptions {
  volume?: number;
  enabled?: boolean;
}

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.3;
  private initialized: boolean = false;

  constructor(options: SoundOptions = {}) {
    this.volume = options.volume || 0.3;
    this.isEnabled = options.enabled !== false;
  }

  private async init() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      this.initialized = true;
    } catch (error) {
      console.warn("Web Audio API não suportada:", error);
    }
  }

  private createTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine"
  ) {
    if (!this.isEnabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(
      frequency,
      this.audioContext.currentTime
    );
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      this.volume * 0.1,
      this.audioContext.currentTime + 0.01
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      this.audioContext.currentTime + duration
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Sons específicos para diferentes ações
  async playClick() {
    await this.init();
    this.createTone(800, 0.1, "sine");
  }

  async playHover() {
    await this.init();
    this.createTone(600, 0.08, "sine");
  }

  async playSuccess() {
    await this.init();
    this.createTone(523, 0.15, "sine"); // C5
    setTimeout(() => this.createTone(659, 0.15, "sine"), 50); // E5
    setTimeout(() => this.createTone(784, 0.2, "sine"), 100); // G5
  }

  async playLike() {
    await this.init();
    this.createTone(440, 0.1, "sine"); // A4
    setTimeout(() => this.createTone(554, 0.1, "sine"), 50); // C#5
    setTimeout(() => this.createTone(659, 0.15, "sine"), 100); // E5
  }

  async playShare() {
    await this.init();
    this.createTone(330, 0.12, "sine"); // E4
    setTimeout(() => this.createTone(440, 0.12, "sine"), 60); // A4
    setTimeout(() => this.createTone(523, 0.15, "sine"), 120); // C5
  }

  async playNavigation() {
    await this.init();
    this.createTone(400, 0.1, "sine");
    setTimeout(() => this.createTone(500, 0.1, "sine"), 40);
  }

  async playFilter() {
    await this.init();
    this.createTone(220, 0.08, "sine");
    setTimeout(() => this.createTone(330, 0.08, "sine"), 30);
    setTimeout(() => this.createTone(440, 0.1, "sine"), 60);
  }

  async playError() {
    await this.init();
    this.createTone(200, 0.2, "square");
    setTimeout(() => this.createTone(150, 0.2, "square"), 100);
  }

  async playNotification() {
    await this.init();
    this.createTone(880, 0.1, "sine");
    setTimeout(() => this.createTone(1108, 0.1, "sine"), 50);
  }

  async playSlideIn() {
    await this.init();
    this.createTone(264, 0.15, "sine"); // C4
    setTimeout(() => this.createTone(330, 0.15, "sine"), 50); // E4
  }

  async playSlideOut() {
    await this.init();
    this.createTone(330, 0.15, "sine"); // E4
    setTimeout(() => this.createTone(264, 0.15, "sine"), 50); // C4
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  getEnabled() {
    return this.isEnabled;
  }

  getVolume() {
    return this.volume;
  }
}
