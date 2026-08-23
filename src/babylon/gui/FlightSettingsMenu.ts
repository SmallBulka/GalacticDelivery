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
import {
  createModalShell,
  stylePrimaryButton,
} from "./GuiHelpers";

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
  { key: "maxSpeed", label: "Макс. скорость", min: 30, max: 300, step: 5, decimals: 0 },
  { key: "thrustAcceleration", label: "Ускорение", min: 7, max: 70, step: 1, decimals: 0 },
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
      500
    );
    this.overlay = shell.overlay;
    shell.title.text = "Настройки полёта";
    shell.closeButton.onPointerClickObservable.add(() => this.close());

    // Тело настроек чуть выше футера — своя высота
    shell.body.height = "360px";

    const settings = this.getSettings();

    for (const def of SETTING_DEFINITIONS) {
      const row = new StackPanel(`settingRow_${def.key}`);
      row.isVertical = false;
      row.height = "48px";
      row.width = "100%";
      shell.body.addControl(row);

      const label = new TextBlock(`label_${def.key}`);
      label.text = def.label;
      label.color = GuiStyles.colors.text;
      label.fontSize = GuiStyles.fontSize.label;
      label.width = "210px";
      label.height = "48px";
      label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      row.addControl(label);

      const slider = new Slider(`slider_${def.key}`);
      slider.minimum = def.min;
      slider.maximum = def.max;
      slider.step = def.step;
      slider.value = settings[def.key] ?? DEFAULT_FLIGHT_SETTINGS[def.key];
      slider.height = "22px";
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
      valueLabel.height = "48px";
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

    // const closeBottomButton = createModalActionButton(
    //   "settingsCloseBottomButton",
    //   "Закрыть",
    //   "primary",
    //   140
    // );
    // closeBottomButton.onPointerClickObservable.add(() => this.close());
    // shell.footer.addControl(closeBottomButton);
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
