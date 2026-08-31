import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  Slider,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import {
  FlightSettingsConfig,
  DEFAULT_FLIGHT_SETTINGS,
} from "../scenes/spaceships/FlightSettingsConfig";
import {
  AudioManager,
  AudioVolumeSettings,
  DEFAULT_AUDIO_VOLUMES,
} from "../audio/AudioManager";
import { GuiStyles } from "./GuiStyles";
import {
  createModalShell,
  stylePrimaryButton,
  styleSectionHeader,
} from "./GuiHelpers";

type SettingKey = keyof FlightSettingsConfig;
type AudioKey = keyof AudioVolumeSettings;

interface SettingDefinition {
  key: SettingKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

interface AudioSettingDefinition {
  key: AudioKey;
  label: string;
}

const SETTING_DEFINITIONS: SettingDefinition[] = [
  { key: "maxSpeed", label: "Макс. скорость", min: 30, max: 300, step: 5, decimals: 0 },
  { key: "thrustAcceleration", label: "Ускорение", min: 7, max: 70, step: 1, decimals: 0 },
  { key: "rotationSpeed", label: "Скорость вращения", min: 0.1, max: 2, step: 0.1, decimals: 1 },
  { key: "linearDamping", label: "Линейное торможение", min: 0.5, max: 0.99, step: 0.01, decimals: 2 },
  { key: "angularDamping", label: "Угловое торможение", min: 0.5, max: 0.99, step: 0.01, decimals: 2 },
];

const AUDIO_DEFINITIONS: AudioSettingDefinition[] = [
  { key: "master", label: "Общая громкость" },
  { key: "music", label: "Музыка" },
  { key: "sfx", label: "Эффекты" },
];

export class FlightSettingsMenu {
  private settingsButton!: Button;
  private overlay!: Rectangle;
  private valueLabels = new Map<SettingKey, TextBlock>();
  private audioValueLabels = new Map<AudioKey, TextBlock>();

  constructor(
    private advancedTexture: AdvancedDynamicTexture,
    private onSettingsChange: (partial: Partial<FlightSettingsConfig>) => void,
    private getSettings: () => FlightSettingsConfig,
    private audioManager: AudioManager
  ) {}

  initialize(topRightStack?: StackPanel): void {
    this.createSettingsButton(topRightStack);
  }

  /** Вызывать после остальных HUD-элементов, чтобы окно было поверх всего. */
  finalize(): void {
    this.createOverlay();
  }

  private createSettingsButton(topRightStack?: StackPanel): void {
    this.settingsButton = Button.CreateSimpleButton(
      "settingsButton",
      "⚙  Настройки"
    );
    this.settingsButton.width = "100%";
    stylePrimaryButton(this.settingsButton);
    this.settingsButton.isPointerBlocker = true;
    this.settingsButton.onPointerClickObservable.add(() => {
      this.open();
    });

    if (topRightStack) {
      topRightStack.addControl(this.settingsButton);
    } else {
      this.settingsButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.settingsButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      this.settingsButton.top = `${GuiStyles.hud.margin}px`;
      this.settingsButton.left = `-${GuiStyles.hud.margin}px`;
      this.advancedTexture.addControl(this.settingsButton);
    }
  }

  private createOverlay(): void {
    const shell = createModalShell(
      this.advancedTexture,
      "settings",
      520,
      620
    );
    this.overlay = shell.overlay;
    shell.title.text = "Настройки";
    shell.closeButton.onPointerClickObservable.add(() => this.close());

    shell.body.height = "480px";

    const flightHeader = new TextBlock("settingsFlightHeader");
    styleSectionHeader(flightHeader, "ПОЛЁТ");
    flightHeader.width = "100%";
    flightHeader.height = "22px";
    flightHeader.paddingLeft = "4px";
    shell.body.addControl(flightHeader);

    const settings = this.getSettings();

    for (const def of SETTING_DEFINITIONS) {
      this.addFlightRow(shell.body, def, settings);
    }

    const audioHeader = new TextBlock("settingsAudioHeader");
    styleSectionHeader(audioHeader, "ЗВУК");
    audioHeader.width = "100%";
    audioHeader.height = "28px";
    audioHeader.paddingLeft = "4px";
    audioHeader.paddingTop = "8px";
    shell.body.addControl(audioHeader);

    const volumes = this.audioManager.getVolumes();
    for (const def of AUDIO_DEFINITIONS) {
      this.addAudioRow(shell.body, def, volumes);
    }
  }

  private addFlightRow(
    body: StackPanel,
    def: SettingDefinition,
    settings: FlightSettingsConfig
  ): void {
    const row = new StackPanel(`settingRow_${def.key}`);
    row.isVertical = false;
    row.height = "44px";
    row.width = "100%";
    body.addControl(row);

    const label = new TextBlock(`label_${def.key}`);
    label.text = def.label;
    label.color = GuiStyles.colors.text;
    label.fontSize = GuiStyles.fontSize.label;
    label.width = "210px";
    label.height = "44px";
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    row.addControl(label);

    const slider = new Slider(`slider_${def.key}`);
    slider.minimum = def.min;
    slider.maximum = def.max;
    slider.step = def.step;
    slider.value = settings[def.key] ?? DEFAULT_FLIGHT_SETTINGS[def.key];
    slider.height = "20px";
    slider.width = "190px";
    slider.background = GuiStyles.colors.sliderBg;
    slider.color = GuiStyles.colors.accent;
    slider.thumbColor = GuiStyles.colors.sliderThumb;
    slider.isThumbCircle = true;
    row.addControl(slider);

    const valueLabel = new TextBlock(`value_${def.key}`);
    valueLabel.color = GuiStyles.colors.textMuted;
    valueLabel.fontSize = GuiStyles.fontSize.value;
    valueLabel.width = "56px";
    valueLabel.height = "44px";
    valueLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    valueLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    valueLabel.text = this.formatValue(slider.value, def.decimals);
    this.valueLabels.set(def.key, valueLabel);
    row.addControl(valueLabel);

    slider.onValueChangedObservable.add((value) => {
      valueLabel.text = this.formatValue(value, def.decimals);
      this.onSettingsChange({ [def.key]: value });
    });
  }

  private addAudioRow(
    body: StackPanel,
    def: AudioSettingDefinition,
    volumes: AudioVolumeSettings
  ): void {
    const row = new StackPanel(`audioRow_${def.key}`);
    row.isVertical = false;
    row.height = "44px";
    row.width = "100%";
    body.addControl(row);

    const label = new TextBlock(`audioLabel_${def.key}`);
    label.text = def.label;
    label.color = GuiStyles.colors.text;
    label.fontSize = GuiStyles.fontSize.label;
    label.width = "210px";
    label.height = "44px";
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    row.addControl(label);

    const slider = new Slider(`audioSlider_${def.key}`);
    slider.minimum = 0;
    slider.maximum = 100;
    slider.step = 1;
    slider.value = Math.round(
      (volumes[def.key] ?? DEFAULT_AUDIO_VOLUMES[def.key]) * 100
    );
    slider.height = "20px";
    slider.width = "190px";
    slider.background = GuiStyles.colors.sliderBg;
    slider.color = GuiStyles.colors.accent;
    slider.thumbColor = GuiStyles.colors.sliderThumb;
    slider.isThumbCircle = true;
    row.addControl(slider);

    const valueLabel = new TextBlock(`audioValue_${def.key}`);
    valueLabel.color = GuiStyles.colors.textMuted;
    valueLabel.fontSize = GuiStyles.fontSize.value;
    valueLabel.width = "56px";
    valueLabel.height = "44px";
    valueLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    valueLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    valueLabel.text = `${slider.value}%`;
    this.audioValueLabels.set(def.key, valueLabel);
    row.addControl(valueLabel);

    slider.onValueChangedObservable.add((value) => {
      const pct = Math.round(value);
      valueLabel.text = `${pct}%`;
      const vol = pct / 100;
      if (def.key === "master") this.audioManager.setMasterVolume(vol);
      else if (def.key === "music") this.audioManager.setMusicVolume(vol);
      else this.audioManager.setSfxVolume(vol);
    });
  }

  open(): void {
    this.overlay.isVisible = true;
  }

  close(): void {
    this.overlay.isVisible = false;
  }

  isOpen(): boolean {
    return this.overlay.isVisible;
  }

  private formatValue(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }
}
