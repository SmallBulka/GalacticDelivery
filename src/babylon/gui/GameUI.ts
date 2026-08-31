import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { FlightSettingsConfig } from "../scenes/spaceships/FlightSettingsConfig";
import { FlightSettingsMenu } from "./FlightSettingsMenu";
import { AudioManager } from "../audio/AudioManager";
import { GuiStyles } from "./GuiStyles";
import {
  bindHudResize,
  createGlassPanel,
  createModalBodyText,
  createModalShell,
  createVerticalStack,
  styleGhostButton,
} from "./GuiHelpers";
import {
  GameCompletionUI,
  PackageChoiceDialogUI,
  QuestDialogUI,
  QuestHudUI,
  ScanProgressUI,
} from "./QuestUI";
import { QuestSwitcherUI } from "./QuestSwitcherUI";
import { KeyboardInputDisplayUI } from "./KeyboardInputDisplayUI";
import { SpeedometerUI } from "./SpeedometerUI";
import { Scene } from "@babylonjs/core";

export class GameUI {
  private toastPanel!: Rectangle;
  private toastText!: TextBlock;
  private energyAlertPanel!: Rectangle;
  private energyAlertText!: TextBlock;
  private energyWarnBand: "ok" | "low" | "empty" = "ok";
  private helpButton!: Button;
  private helpOverlay!: Rectangle;
  private topRightStack!: StackPanel;
  private settingsMenu!: FlightSettingsMenu;
  private questDialog!: QuestDialogUI;
  private scanProgressUI!: ScanProgressUI;
  private packageChoice!: PackageChoiceDialogUI;
  private questHud!: QuestHudUI;
  private completionScreen!: GameCompletionUI;
  private questSwitcher!: QuestSwitcherUI;
  private keyboardDisplay!: KeyboardInputDisplayUI;
  private speedometer!: SpeedometerUI;
  private messageTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private advancedTexture: AdvancedDynamicTexture,
    private onSettingsChange: (partial: Partial<FlightSettingsConfig>) => void,
    private getSettings: () => FlightSettingsConfig,
    private audioManager: AudioManager
  ) {}

  initialize(): void {
    this.createTopBar();

    this.settingsMenu = new FlightSettingsMenu(
      this.advancedTexture,
      this.onSettingsChange,
      this.getSettings,
      this.audioManager
    );
    this.settingsMenu.initialize(this.topRightStack);

    this.helpButton = Button.CreateSimpleButton("helpButton", "?  Подсказка");
    this.helpButton.width = "100%";
    styleGhostButton(this.helpButton);
    this.helpButton.isPointerBlocker = true;
    this.topRightStack.addControl(this.helpButton);

    this.createToast();

    this.keyboardDisplay = new KeyboardInputDisplayUI(this.advancedTexture);
    this.keyboardDisplay.initialize();

    this.speedometer = new SpeedometerUI(this.advancedTexture);
    this.speedometer.initialize();

    this.questDialog = new QuestDialogUI(this.advancedTexture);
    this.questDialog.initialize();

    this.scanProgressUI = new ScanProgressUI(this.advancedTexture);
    this.scanProgressUI.initialize();

    this.packageChoice = new PackageChoiceDialogUI(this.advancedTexture);
    this.packageChoice.initialize();

    this.questHud = new QuestHudUI(this.advancedTexture);
    this.questHud.initialize();

    this.completionScreen = new GameCompletionUI(this.advancedTexture);
    this.completionScreen.initialize();

    this.createHelpPanel();
    this.settingsMenu.finalize();

    // После всего HUD, чтобы полоса была поверх и не терялась при HMR-порядке
    this.createEnergyAlert();

    bindHudResize(this.advancedTexture, (scale) => {
      this.keyboardDisplay.applyScale(scale);
      this.speedometer.applyScale(scale);
    });
  }

  updateSpeedometer(
    speed: number,
    maxSpeed: number,
    energyPercent = 100,
    crates = 0
  ): void {
    this.speedometer.update(speed, maxSpeed, energyPercent, crates);
    this.updateEnergyWarning(energyPercent);
  }

  /** Предупреждение сверху: ≤25% — низкий заряд; 0% — перезапуск. */
  updateEnergyWarning(energyPercent: number): void {
    const energy = Math.round(energyPercent);
    let band: "ok" | "low" | "empty" = "ok";
    if (energy <= 0) band = "empty";
    else if (energy <= 25) band = "low";

    if (band === "empty") {
      this.energyAlertText.text =
        "Заряд исчерпан. Нажмите R, чтобы перезапустить игру.";
      this.energyAlertText.color = GuiStyles.colors.danger;
      this.energyAlertPanel.background = "rgba(80, 12, 20, 0.94)";
      this.energyAlertPanel.color = GuiStyles.colors.danger;
      this.energyAlertPanel.width = "400px";
      this.energyAlertPanel.alpha = 1;
      this.energyAlertPanel.isVisible = true;
    } else if (band === "low") {
      this.energyAlertText.text = "Внимание: низкий заряд энергии!";
      this.energyAlertText.color = "#ffcc66";
      this.energyAlertPanel.width = "400px";
      this.energyAlertPanel.background = "rgba(60, 36, 8, 0.94)";
      this.energyAlertPanel.color = "#ffb347";
      this.energyAlertPanel.alpha = 1;
      this.energyAlertPanel.isVisible = true;
    } else {
      this.energyAlertPanel.isVisible = false;
      this.energyAlertPanel.alpha = 0;
    }

    if (band !== this.energyWarnBand) {
      this.energyWarnBand = band;
      if (band === "low") {
        this.showMessage("Внимание: низкий заряд энергии!", 4500);
      } else if (band === "empty") {
        this.showMessage(
          "Заряд исчерпан. Нажмите R, чтобы перезапустить игру.",
          8000
        );
      }
    }
  }

  /** Сброс баннера при перезапуске (R). */
  resetEnergyWarning(): void {
    this.energyWarnBand = "ok";
    this.energyAlertPanel.isVisible = false;
    this.energyAlertPanel.alpha = 0;
  }

  setQuestSelectHandler(handler: (id: import("../quests/QuestTypes").QuestId) => void): void {
    this.questSwitcher.setSelectHandler(handler);
  }

  refreshQuestList(items: any[]): void {
    this.questSwitcher.refresh(items);
  }

  /** Любое модальное окно поверх игры (настройки, помощь, квесты…). */
  isAnyModalOpen(): boolean {
    return (
      this.helpOverlay.isVisible ||
      this.settingsMenu.isOpen() ||
      this.questDialog.isOpen() ||
      this.packageChoice.isOpen() ||
      this.completionScreen.isOpen()
    );
  }

  bindKeyboardDisplay(scene: Scene, getGamepadSticks?: () => import("../scenes/spaceships/GamepadInputProvider").GamepadStickDisplay): void {
    this.keyboardDisplay.bindScene(scene, getGamepadSticks);
  }

  getQuestUIBundle() {
    return {
      questDialog: this.questDialog,
      scanProgress: this.scanProgressUI,
      packageChoice: this.packageChoice,
      questHud: this.questHud,
      completionScreen: this.completionScreen,
    };
  }

  showMessage(text: string, duration = 3000): void {
    this.toastText.text = text;
    this.toastPanel.isVisible = true;

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = setTimeout(() => {
      this.toastPanel.isVisible = false;
      this.toastText.text = "";
      this.messageTimeout = undefined;
    }, duration);
  }

  private createTopBar(): void {
    const margin = GuiStyles.hud.margin;

    const leftStack = createVerticalStack("hudLeftStack", GuiStyles.spacing.sm);
    leftStack.width = `${GuiStyles.hud.leftPanelWidth}px`;
    leftStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftStack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    leftStack.left = `${margin}px`;
    leftStack.top = `${margin}px`;
    this.advancedTexture.addControl(leftStack);

    this.questSwitcher = new QuestSwitcherUI(this.advancedTexture);
    this.questSwitcher.initialize(leftStack);

    this.topRightStack = createVerticalStack("hudTopRightStack", GuiStyles.spacing.sm, true);
    this.topRightStack.width = `${GuiStyles.hud.rightPanelWidth}px`;
    this.topRightStack.zIndex = 50;
    this.topRightStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.topRightStack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.topRightStack.top = `${margin}px`;
    this.topRightStack.left = `-${margin}px`;
    this.advancedTexture.addControl(this.topRightStack);
  }

  private createToast(): void {
    this.toastPanel = createGlassPanel("gameToastPanel", "min(520px, 80%)", 52, true);
    this.toastPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.toastPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.toastPanel.top = "-72px";
    this.toastPanel.isVisible = false;
    this.toastPanel.isHitTestVisible = false;
    this.advancedTexture.addControl(this.toastPanel);

    this.toastText = new TextBlock("gameToast");
    this.toastText.text = "";
    this.toastText.width = "94%";
    this.toastText.height = "52px";
    this.toastText.fontSize = GuiStyles.fontSize.message;
    this.toastText.fontWeight = "600";
    this.toastText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.toastText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.toastText.color = GuiStyles.colors.text;
    this.toastText.textWrapping = true;
    this.toastText.isHitTestVisible = false;
    this.toastPanel.addControl(this.toastText);
  }

  private createEnergyAlert(): void {
    this.energyAlertPanel = new Rectangle("energyAlertPanel");
    this.energyAlertPanel.width = "70%";
    this.energyAlertPanel.height = "56px";
    this.energyAlertPanel.thickness = 2;
    this.energyAlertPanel.cornerRadius = GuiStyles.radius.lg;
    this.energyAlertPanel.background = "rgba(60, 36, 8, 0.94)";
    this.energyAlertPanel.color = "#ffb347";
    this.energyAlertPanel.horizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.energyAlertPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.energyAlertPanel.top = "20px";
    this.energyAlertPanel.zIndex = 800;
    this.energyAlertPanel.isVisible = false;
    this.energyAlertPanel.alpha = 0;
    this.energyAlertPanel.isHitTestVisible = false;
    this.energyAlertPanel.isPointerBlocker = false;
    this.advancedTexture.addControl(this.energyAlertPanel);

    this.energyAlertText = new TextBlock("energyAlertText", "");
    this.energyAlertText.width = "96%";
    this.energyAlertText.height = "56px";
    this.energyAlertText.fontSize = GuiStyles.fontSize.message;
    this.energyAlertText.fontWeight = "700";
    this.energyAlertText.color = "#ffcc66";
    this.energyAlertText.outlineWidth = 2;
    this.energyAlertText.outlineColor = "#000000";
    this.energyAlertText.textHorizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.energyAlertText.textVerticalAlignment =
      Control.VERTICAL_ALIGNMENT_CENTER;
    this.energyAlertText.textWrapping = true;
    this.energyAlertText.isHitTestVisible = false;
    this.energyAlertPanel.addControl(this.energyAlertText);
  }

  private createHelpPanel(): void {
    const shell = createModalShell(
      this.advancedTexture,
      "help",
      520,
      450
    );
    this.helpOverlay = shell.overlay;
    shell.title.text = "Управление";
    shell.closeButton.onPointerClickObservable.add(() => {
      this.helpOverlay.isVisible = false;
    });

    const infoText = createModalBodyText("infoText", 380);
    infoText.fontSize = GuiStyles.fontSize.help;
    infoText.text =
      "Клавиатура:\n" +
      "W / S — вперёд / назад\n" +
      "A / D — рысканье\n" +
      "↑ ↓ ← → — тангаж и крен\n" +
      "R — перезапуск (позиция и заряд)\n\n" +
      "Геймпад:\n" +
      "Левый стик — тяга и рысканье\n" +
      "Правый стик — тангаж и крен\n\n" +
      "Энергия:\n" +
      "Тратится в полёте. Контейнеры рядом с кораблём\n" +
      "пополняют заряд на 10%.";
    shell.body.height = "400px";
    shell.body.addControl(infoText);

    // const closeBottom = createModalActionButton(
    //   "helpCloseBottom",
    //   "Понятно",
    //   "primary",
    //   140
    // );
    // closeBottom.onPointerClickObservable.add(() => {
    //   this.helpOverlay.isVisible = false;
    // });
    // shell.footer.addControl(closeBottom);

    this.helpButton.onPointerClickObservable.add(() => {
      this.helpOverlay.isVisible = true;
    });
  }
}
