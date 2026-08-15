import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import { FlightSettingsConfig } from "../scenes/spaceships/FlightSettingsConfig";
import { FlightSettingsMenu } from "./FlightSettingsMenu";
import { GuiStyles } from "./GuiStyles";

export class GameUI {
  private scoreText!: TextBlock;
  private helpButton!: Button;
  private settingsMenu!: FlightSettingsMenu;
  private messageTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private advancedTexture: AdvancedDynamicTexture,
    private onSettingsChange: (partial: Partial<FlightSettingsConfig>) => void,
    private getSettings: () => FlightSettingsConfig
  ) {}

  initialize(): void {
    this.createScoreText();
    this.createHelpButton();
    this.settingsMenu = new FlightSettingsMenu(
      this.advancedTexture,
      this.onSettingsChange,
      this.getSettings
    );
    this.settingsMenu.initialize();
  }

  updateScore(text: string): void {
    this.scoreText.text = text;
  }

  showMessage(text: string, duration = 3000): void {
    const message = new TextBlock("gameMessage");
    message.text = text;
    message.color = GuiStyles.colors.text;
    message.fontSize = GuiStyles.fontSize.message;
    message.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    message.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

    this.advancedTexture.addControl(message);

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = setTimeout(() => {
      this.advancedTexture.removeControl(message);
      this.messageTimeout = undefined;
    }, duration);
  }

  private createScoreText(): void {
    this.scoreText = new TextBlock("scoreText");
    this.scoreText.text = "Собрано: 0 / 3";
    this.scoreText.color = GuiStyles.colors.text;
    this.scoreText.fontSize = GuiStyles.fontSize.score;
    this.scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.scoreText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.scoreText.paddingLeft = GuiStyles.padding.screen;
    this.scoreText.paddingTop = GuiStyles.padding.screen;

    this.advancedTexture.addControl(this.scoreText);
  }

  private createHelpButton(): void {
    this.helpButton = Button.CreateSimpleButton("helpButton", "Подсказка");
    this.helpButton.width = GuiStyles.button.helpWidth;
    this.helpButton.height = GuiStyles.button.helpHeight;
    this.helpButton.color = GuiStyles.colors.text;
    this.helpButton.background = GuiStyles.colors.accentDark;
    this.helpButton.cornerRadius = GuiStyles.button.cornerRadius;
    this.helpButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.helpButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.helpButton.paddingRight = "180px";
    this.helpButton.paddingTop = GuiStyles.padding.screen;
    this.advancedTexture.addControl(this.helpButton);

    const infoRect = new Rectangle("infoRect");
    infoRect.width = GuiStyles.helpPanel.width;
    infoRect.height = GuiStyles.helpPanel.height;
    infoRect.cornerRadius = 10;
    infoRect.color = GuiStyles.colors.text;
    infoRect.thickness = 2;
    infoRect.background = GuiStyles.colors.panelBg;
    infoRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    infoRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    infoRect.isVisible = false;
    this.advancedTexture.addControl(infoRect);

    const infoText = new TextBlock("infoText");
    infoText.text =
      "Клавиатура:\n" +
      "W / S — вперёд / назад\n" +
      "A / D — рысканье (влево / вправо)\n" +
      "↑ ↓ — тангаж\n" +
      "← → — крен\n" +
      "R — сброс позиции\n\n" +
      "Геймпад:\n" +
      "Левый стик Y — тяга\n" +
      "Левый стик X — рысканье\n" +
      "Правый стик Y — тангаж\n" +
      "Правый стик X — крен\n\n" +
      "Скорость и чувствительность — в «Настройки».";
    infoText.color = GuiStyles.colors.text;
    infoText.fontSize = GuiStyles.fontSize.help;
    infoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    infoText.paddingLeft = "28px";
    infoText.paddingRight = "28px";
    infoText.paddingTop = "16px";
    infoRect.addControl(infoText);

    const closeButton = Button.CreateSimpleButton("helpCloseButton", "X");
    closeButton.width = "30px";
    closeButton.height = "30px";
    closeButton.color = GuiStyles.colors.text;
    closeButton.background = GuiStyles.colors.danger;
    closeButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    closeButton.paddingRight = "5px";
    closeButton.paddingTop = "5px";
    closeButton.onPointerClickObservable.add(() => {
      infoRect.isVisible = false;
    });
    infoRect.addControl(closeButton);

    this.helpButton.onPointerClickObservable.add(() => {
      infoRect.isVisible = true;
    });
  }
}
