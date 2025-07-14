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

  // Sons originais
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
    this.createTone(523, 0.15, "sine");
    setTimeout(() => this.createTone(659, 0.15, "sine"), 50);
    setTimeout(() => this.createTone(784, 0.2, "sine"), 100);
  }

  async playLike() {
    await this.init();
    this.createTone(440, 0.1, "sine");
    setTimeout(() => this.createTone(554, 0.1, "sine"), 50);
    setTimeout(() => this.createTone(659, 0.15, "sine"), 100);
  }

  async playShare() {
    await this.init();
    this.createTone(330, 0.12, "sine");
    setTimeout(() => this.createTone(440, 0.12, "sine"), 60);
    setTimeout(() => this.createTone(523, 0.15, "sine"), 120);
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
    this.createTone(264, 0.15, "sine");
    setTimeout(() => this.createTone(330, 0.15, "sine"), 50);
  }

  async playSlideOut() {
    await this.init();
    this.createTone(330, 0.15, "sine");
    setTimeout(() => this.createTone(264, 0.15, "sine"), 50);
  }

  // 🆕 NOVOS SONS MECÂNICOS
  async playTap() {
    await this.init();
    this.createTone(600, 0.04, "sine");
  }

  async playTick() {
    await this.init();
    this.createTone(1200, 0.03, "square");
  }

  async playClik() {
    await this.init();
    this.createTone(2000, 0.02, "square");
  }

  async playPop() {
    await this.init();
    this.createTone(800, 0.05, "triangle");
    setTimeout(() => this.createTone(400, 0.03, "square"), 10);
  }

  async playSnap() {
    await this.init();
    this.createTone(1500, 0.015, "square");
    setTimeout(() => this.createTone(800, 0.025, "triangle"), 5);
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
