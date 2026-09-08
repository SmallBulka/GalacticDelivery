/**
 * Аудио: фоновая музыка и SFX с громкостью master/music/sfx.
 */

export interface AudioVolumeSettings {
  /** Общая громкость 0…1 */
  master: number;
  /** Музыка 0…1 (умножается на master) */
  music: number;
  /** Эффекты 0…1 (умножается на master) */
  sfx: number;
}

export type MusicId = "ambient" | string;
export type SfxId =
  | "ui_click"
  | "pickup"
  | "collision"
  | "quest_start"
  | "ring_pass"
  | string;

const STORAGE_KEY = "galacticDelivery.audioVolumes";

/** Пути относительно public/ */
export const AUDIO_PATHS = {
  music: {
    ambient: "./audio/romariogrande__space-ambient.wav",
  },
  sfx: {
    ui_click: "./audio/button%20clicks.mp3",
    collision: "./audio/material-sound-effect-collision-crush.mp3",
    quest_start: "./audio/task_picking.mp3",
    ring_pass: "./audio/zvezda--poluchena.mp3",
  },
} as const;

export const DEFAULT_AUDIO_VOLUMES: AudioVolumeSettings = {
  master: 0.8,
  music: 0.55,
  sfx: 0.75,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function loadVolumes(): AudioVolumeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_VOLUMES };
    const parsed = JSON.parse(raw) as Partial<AudioVolumeSettings>;
    return {
      master: clamp01(parsed.master ?? DEFAULT_AUDIO_VOLUMES.master),
      music: clamp01(parsed.music ?? DEFAULT_AUDIO_VOLUMES.music),
      sfx: clamp01(parsed.sfx ?? DEFAULT_AUDIO_VOLUMES.sfx),
    };
  } catch {
    return { ...DEFAULT_AUDIO_VOLUMES };
  }
}

let activeManager: AudioManager | null = null;

export function getActiveAudioManager(): AudioManager | null {
  return activeManager;
}

export class AudioManager {
  private volumes: AudioVolumeSettings;
  private musicEl: HTMLAudioElement | null = null;
  private currentMusicId: MusicId | null = null;
  private sfxCache = new Map<SfxId, HTMLAudioElement>();
  private musicUrls = new Map<MusicId, string>();
  private sfxUrls = new Map<SfxId, string>();
  private unlockArmed = false;
  private pendingMusic: { id: MusicId; loop: boolean } | null = null;

  constructor() {
    this.volumes = loadVolumes();
    activeManager = this;
  }

  getVolumes(): AudioVolumeSettings {
    return { ...this.volumes };
  }

  setMasterVolume(value: number): void {
    this.volumes.master = clamp01(value);
    this.persist();
    this.applyVolumes();
  }

  setMusicVolume(value: number): void {
    this.volumes.music = clamp01(value);
    this.persist();
    this.applyVolumes();
  }

  setSfxVolume(value: number): void {
    this.volumes.sfx = clamp01(value);
    this.persist();
    this.applyVolumes();
  }

  getEffectiveMusicVolume(): number {
    return this.volumes.master * this.volumes.music;
  }

  getEffectiveSfxVolume(): number {
    return this.volumes.master * this.volumes.sfx;
  }

  async preload(manifest?: {
    music?: Record<MusicId, string>;
    sfx?: Record<SfxId, string>;
  }): Promise<void> {
    const music = { ...AUDIO_PATHS.music, ...manifest?.music };
    const sfx = { ...AUDIO_PATHS.sfx, ...manifest?.sfx };

    const tasks: Promise<void>[] = [];

    for (const [id, url] of Object.entries(music)) {
      this.musicUrls.set(id, url);
      tasks.push(this.warmAudio(url));
    }
    for (const [id, url] of Object.entries(sfx)) {
      this.sfxUrls.set(id, url);
      const el = new Audio(url);
      el.preload = "auto";
      this.sfxCache.set(id, el);
      tasks.push(this.warmAudio(url, el));
    }

    await Promise.allSettled(tasks);
  }

  /** Фоновая музыка (по умолчанию loop). */
  playMusic(id: MusicId, options?: { loop?: boolean }): void {
    const loop = options?.loop !== false;
    const url = this.musicUrls.get(id) ?? AUDIO_PATHS.music[id as keyof typeof AUDIO_PATHS.music];
    if (!url) {
      console.warn(`[Audio] неизвестный трек: ${id}`);
      return;
    }

    this.pendingMusic = { id, loop };

    if (this.musicEl && this.currentMusicId === id) {
      this.musicEl.loop = loop;
      this.musicEl.volume = this.getEffectiveMusicVolume();
      void this.tryPlayMusic();
      return;
    }

    this.stopMusic();
    this.musicEl = new Audio(url);
    this.musicEl.loop = loop;
    this.musicEl.preload = "auto";
    this.musicEl.volume = this.getEffectiveMusicVolume();
    this.currentMusicId = id;
    void this.tryPlayMusic();
  }

  stopMusic(): void {
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.src = "";
      this.musicEl = null;
    }
    this.currentMusicId = null;
  }

  /** Одноразовый эффект (клик UI и т.п.). */
  playSfx(id: SfxId, options?: { volumeScale?: number }): void {
    const scale = options?.volumeScale ?? 1;
    let template = this.sfxCache.get(id);
    if (!template) {
      const url =
        this.sfxUrls.get(id) ??
        AUDIO_PATHS.sfx[id as keyof typeof AUDIO_PATHS.sfx];
      if (!url) return;
      template = new Audio(url);
      template.preload = "auto";
      this.sfxCache.set(id, template);
      this.sfxUrls.set(id, url);
    }

    const node = template.cloneNode(true) as HTMLAudioElement;
    node.volume = Math.min(1, this.getEffectiveSfxVolume() * scale);
    void node.play().catch(() => {
      /* autoplay / gesture */
    });
  }

  /**
   * Если браузер заблокировал autoplay — продолжить музыку
   * после первого жеста пользователя.
   */
  armAutoplayUnlock(target: HTMLElement | Window = window): void {
    if (this.unlockArmed) return;
    this.unlockArmed = true;

    const unlock = () => {
      target.removeEventListener("pointerdown", unlock);
      target.removeEventListener("keydown", unlock);
      if (this.pendingMusic) {
        this.playMusic(this.pendingMusic.id, { loop: this.pendingMusic.loop });
      } else if (this.musicEl && this.musicEl.paused) {
        void this.tryPlayMusic();
      }
    };

    target.addEventListener("pointerdown", unlock, { once: true });
    target.addEventListener("keydown", unlock, { once: true });
  }

  dispose(): void {
    this.stopMusic();
    this.sfxCache.clear();
    if (activeManager === this) activeManager = null;
  }

  private async tryPlayMusic(): Promise<void> {
    if (!this.musicEl) return;
    this.musicEl.volume = this.getEffectiveMusicVolume();
    try {
      await this.musicEl.play();
    } catch {
      /* ждём жест — armAutoplayUnlock */
    }
  }

  private applyVolumes(): void {
    if (this.musicEl) {
      this.musicEl.volume = this.getEffectiveMusicVolume();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.volumes));
    } catch {
      /* ignore quota */
    }
  }

  private warmAudio(url: string, el?: HTMLAudioElement): Promise<void> {
    const audio = el ?? new Audio(url);
    audio.preload = "auto";
    return new Promise((resolve) => {
      const done = () => resolve();
      if (audio.readyState >= 2) {
        done();
        return;
      }
      audio.addEventListener("canplaythrough", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      audio.load();
    });
  }
}
