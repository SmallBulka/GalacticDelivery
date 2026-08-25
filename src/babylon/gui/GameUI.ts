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
import { RadarNavigationUI } from "./RadarNavigationUI";
import { KeyboardInputDisplayUI } from "./KeyboardInputDisplayUI";
import { SpeedometerUI } from "./SpeedometerUI";
import { Scene } from "@babylonjs/core";

export class GameUI {
  private toastPanel!: Rectangle;
  private toastText!: TextBlock;
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
  private radar!: RadarNavigationUI;
  private keyboardDisplay!: KeyboardInputDisplayUI;
  private speedometer!: SpeedometerUI;
  private messageTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private advancedTexture: AdvancedDynamicTexture,
    private onSettingsChange: (partial: Partial<FlightSettingsConfig>) => void,
    private getSettings: () => FlightSettingsConfig
  ) {}

  initialize(): void {
    this.createTopBar();

    this.settingsMenu = new FlightSettingsMenu(
      this.advancedTexture,
      this.onSettingsChange,
      this.getSettings
    );
    this.settingsMenu.initialize(this.topRightStack);

    this.helpButton = Button.CreateSimpleButton("helpButton", "?  Подсказка");
    this.helpButton.width = "100%";
    styleGhostButton(this.helpButton);
    this.helpButton.isPointerBlocker = true;
    this.topRightStack.addControl(this.helpButton);

    this.createToast();

    this.radar = new RadarNavigationUI(this.advancedTexture);
    this.radar.initialize();

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

    bindHudResize(this.advancedTexture, (scale) => {
      this.radar.applyScale(scale);
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
  }

  setQuestSelectHandler(handler: (id: import("../quests/QuestTypes").QuestId) => void): void {
    this.questSwitcher.setSelectHandler(handler);
  }

  refreshQuestList(items: any[]): void {
    this.questSwitcher.refresh(items);
  }

  getRadar(): RadarNavigationUI {
    return this.radar;
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
      radar: this.radar,
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

  private createHelpPanel(): void {
    const shell = createModalShell(
      this.advancedTexture,
      "help",
      520,
      350
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
      "R — сброс позиции\n\n" +
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
