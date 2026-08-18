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
import { GuiStyles } from "./GuiStyles";

type SettingKey = keyof FlightSettingsConfig;

interface SettingDefinition {
  key: SettingKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

const SETTING_DEFINITIONS: SettingDefinition[] = [
  { key: "maxSpeed", label: "Макс. скорость", min: 20, max: 200, step: 5, decimals: 0 },
  { key: "thrustAcceleration", label: "Ускорение", min: 5, max: 50, step: 1, decimals: 0 },
  { key: "rotationSpeed", label: "Скорость вращения", min: 0.1, max: 2, step: 0.1, decimals: 1 },
  { key: "linearDamping", label: "Линейное торможение", min: 0.5, max: 0.99, step: 0.01, decimals: 2 },
  { key: "angularDamping", label: "Угловое торможение", min: 0.5, max: 0.99, step: 0.01, decimals: 2 },
];

export class FlightSettingsMenu {
  private settingsButton!: Button;
  private overlay!: Rectangle;
  private valueLabels = new Map<SettingKey, TextBlock>();

  constructor(
    private advancedTexture: AdvancedDynamicTexture,
    private onSettingsChange: (partial: Partial<FlightSettingsConfig>) => void,
    private getSettings: () => FlightSettingsConfig
  ) {}

  initialize(): void {
    this.createSettingsButton();
    this.createOverlay();
  }

  private createSettingsButton(): void {
    this.settingsButton = Button.CreateSimpleButton(
      "settingsButton",
      "⚙ Настройки"
    );
    this.settingsButton.width = GuiStyles.button.settingsWidth;
    this.settingsButton.height = GuiStyles.button.settingsHeight;
    this.settingsButton.color = GuiStyles.colors.text;
    this.settingsButton.background = GuiStyles.colors.accent;
    this.settingsButton.cornerRadius = GuiStyles.button.cornerRadius;
    this.settingsButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.settingsButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.settingsButton.top = "16px";
    this.settingsButton.left = "-16px";
    this.settingsButton.isPointerBlocker = true;
    this.settingsButton.onPointerClickObservable.add(() => {
      this.open();
    });

    this.advancedTexture.addControl(this.settingsButton);
  }

  private createOverlay(): void {
    this.overlay = new Rectangle("settingsOverlay");
    this.overlay.width = "100%";
    this.overlay.height = "100%";
    this.overlay.thickness = 0;
    this.overlay.background = GuiStyles.colors.overlayBg;
    this.overlay.isVisible = false;
    this.overlay.isPointerBlocker = true;
    this.advancedTexture.addControl(this.overlay);

    const panel = new Rectangle("settingsPanel");
    panel.width = GuiStyles.settingsPanel.width;
    panel.height = GuiStyles.settingsPanel.height;
    panel.cornerRadius = 10;
    panel.color = GuiStyles.colors.text;
    panel.thickness = 2;
    panel.background = GuiStyles.colors.cardBg;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.overlay.addControl(panel);

    const title = new TextBlock("settingsTitle");
    title.text = "Настройки полёта";
    title.color = GuiStyles.colors.text;
    title.fontSize = GuiStyles.fontSize.title;
    title.height = "40px";
    title.paddingTop = "16px";
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.addControl(title);

    const closeButton = Button.CreateSimpleButton("settingsCloseButton", "✕");
    closeButton.width = "36px";
    closeButton.height = "36px";
    closeButton.color = GuiStyles.colors.text;
    closeButton.background = GuiStyles.colors.danger;
    closeButton.cornerRadius = GuiStyles.button.cornerRadius;
    closeButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    closeButton.paddingRight = "12px";
    closeButton.paddingTop = "12px";
    closeButton.onPointerClickObservable.add(() => this.close());
    panel.addControl(closeButton);

    const stack = new StackPanel("settingsStack");
    stack.width = "90%";
    stack.height = "340px";
    stack.paddingTop = "60px";
    stack.spacing = 12;
    panel.addControl(stack);

    const settings = this.getSettings();

    for (const def of SETTING_DEFINITIONS) {
      const row = new StackPanel(`settingRow_${def.key}`);
      row.isVertical = false;
      row.height = "48px";
      row.width = "100%";
      stack.addControl(row);

      const label = new TextBlock(`label_${def.key}`);
      label.text = def.label;
      label.color = GuiStyles.colors.text;
      label.fontSize = GuiStyles.fontSize.label;
      label.width = "220px";
      label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      row.addControl(label);

      const slider = new Slider(`slider_${def.key}`);
      slider.minimum = def.min;
      slider.maximum = def.max;
      slider.step = def.step;
      slider.value = settings[def.key] ?? DEFAULT_FLIGHT_SETTINGS[def.key];
      slider.height = "24px";
      slider.width = "180px";
      slider.background = GuiStyles.colors.sliderBg;
      slider.color = GuiStyles.colors.accent;
      slider.thumbColor = GuiStyles.colors.sliderThumb;
      slider.isThumbCircle = true;
      row.addControl(slider);

      const valueLabel = new TextBlock(`value_${def.key}`);
      valueLabel.color = GuiStyles.colors.text;
      valueLabel.fontSize = GuiStyles.fontSize.value;
      valueLabel.width = "60px";
      valueLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      valueLabel.text = this.formatValue(slider.value, def.decimals);
      this.valueLabels.set(def.key, valueLabel);
      row.addControl(valueLabel);

      slider.onValueChangedObservable.add((value) => {
        valueLabel.text = this.formatValue(value, def.decimals);
        this.onSettingsChange({ [def.key]: value });
      });
    }

    const closeBottomButton = Button.CreateSimpleButton(
      "settingsCloseBottomButton",
      "Закрыть"
    );
    closeBottomButton.width = "120px";
    closeBottomButton.height = "40px";
    closeBottomButton.color = GuiStyles.colors.text;
    closeBottomButton.background = GuiStyles.colors.accentDark;
    closeBottomButton.cornerRadius = GuiStyles.button.cornerRadius;
    closeBottomButton.paddingTop = "8px";
    closeBottomButton.onPointerClickObservable.add(() => this.close());
    stack.addControl(closeBottomButton);
  }

  open(): void {
    this.overlay.isVisible = true;
  }

  close(): void {
    this.overlay.isVisible = false;
  }

  private formatValue(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }
}
