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
  GameCompletionUI,
  PackageChoiceDialogUI,
  QuestCompletedListUI,
  QuestDialogUI,
  QuestHudUI,
  ScanProgressUI,
} from "./QuestUI";

function decorateHudText(block: TextBlock): void {
  block.isHitTestVisible = false;
  block.isPointerBlocker = false;
  block.textWrapping = true;
}

export class GameUI {
  private scoreText!: TextBlock;
  private questTrackerText!: TextBlock;
  private toastText!: TextBlock;
  private helpButton!: Button;
  private questListButton!: Button;
  private settingsMenu!: FlightSettingsMenu;
  private questDialog!: QuestDialogUI;
  private scanProgressUI!: ScanProgressUI;
  private packageChoice!: PackageChoiceDialogUI;
  private questHud!: QuestHudUI;
  private completedList!: QuestCompletedListUI;
  private completionScreen!: GameCompletionUI;
  private messageTimeout?: ReturnType<typeof setTimeout>;
  private onShowQuestList?: () => void;

  constructor(
    private advancedTexture: AdvancedDynamicTexture,
    private onSettingsChange: (partial: Partial<FlightSettingsConfig>) => void,
    private getSettings: () => FlightSettingsConfig
  ) {}

  initialize(): void {
    this.createTopBar();
    this.createToast();
    this.createHelpPanel();

    this.settingsMenu = new FlightSettingsMenu(
      this.advancedTexture,
      this.onSettingsChange,
      this.getSettings
    );
    this.settingsMenu.initialize();

    this.questDialog = new QuestDialogUI(this.advancedTexture);
    this.questDialog.initialize();

    this.scanProgressUI = new ScanProgressUI(this.advancedTexture);
    this.scanProgressUI.initialize();

    this.packageChoice = new PackageChoiceDialogUI(this.advancedTexture);
    this.packageChoice.initialize();

    this.questHud = new QuestHudUI(this.advancedTexture);
    this.questHud.initialize();

    this.completedList = new QuestCompletedListUI(this.advancedTexture);
    this.completedList.initialize();

    this.completionScreen = new GameCompletionUI(this.advancedTexture);
    this.completionScreen.initialize();
  }

  setQuestListHandler(handler: () => void): void {
    this.onShowQuestList = handler;
  }

  getQuestUIBundle() {
    return {
      questDialog: this.questDialog,
      scanProgress: this.scanProgressUI,
      packageChoice: this.packageChoice,
      questHud: this.questHud,
      completedList: this.completedList,
      completionScreen: this.completionScreen,
    };
  }

  updateScore(text: string): void {
    this.scoreText.text = text;
  }

  updateQuestTracker(text: string): void {
    this.questTrackerText.text = text;
  }

  showMessage(text: string, duration = 3000): void {
    this.toastText.text = text;
    this.toastText.isVisible = true;

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = setTimeout(() => {
      this.toastText.isVisible = false;
      this.toastText.text = "";
      this.messageTimeout = undefined;
    }, duration);
  }

  private createTopBar(): void {
    const leftStack = new StackPanel("hudLeftStack");
    leftStack.isVertical = true;
    leftStack.width = "220px";
    leftStack.height = "110px";
    leftStack.spacing = 8;
    leftStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftStack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    leftStack.left = "16px";
    leftStack.top = "16px";
    leftStack.isPointerBlocker = false;
    this.advancedTexture.addControl(leftStack);

    this.scoreText = new TextBlock("scoreText", "Собрано: 0 / 3");
    this.scoreText.color = GuiStyles.colors.text;
    this.scoreText.fontSize = 20;
    this.scoreText.height = "28px";
    this.scoreText.width = "220px";
    this.scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    decorateHudText(this.scoreText);
    leftStack.addControl(this.scoreText);

    this.questListButton = Button.CreateSimpleButton("questListButton", "Задания");
    this.questListButton.width = "140px";
    this.questListButton.height = "40px";
    this.questListButton.color = GuiStyles.colors.text;
    this.questListButton.background = "#2a6b4a";
    this.questListButton.cornerRadius = GuiStyles.button.cornerRadius;
    this.questListButton.isPointerBlocker = true;
    this.questListButton.onPointerClickObservable.add(() => {
      this.onShowQuestList?.();
    });
    leftStack.addControl(this.questListButton);

    this.helpButton = Button.CreateSimpleButton("helpButton", "Подсказка");
    this.helpButton.width = GuiStyles.button.helpWidth;
    this.helpButton.height = GuiStyles.button.helpHeight;
    this.helpButton.color = GuiStyles.colors.text;
    this.helpButton.background = GuiStyles.colors.accentDark;
    this.helpButton.cornerRadius = GuiStyles.button.cornerRadius;
    this.helpButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.helpButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.helpButton.top = "16px";
    this.helpButton.left = "-170px";
    this.helpButton.isPointerBlocker = true;
    this.advancedTexture.addControl(this.helpButton);

    const trackerBar = new Rectangle("questTrackerBar");
    trackerBar.width = "55%";
    trackerBar.height = "52px";
    trackerBar.thickness = 0;
    trackerBar.background = "rgba(0, 0, 0, 0.45)";
    trackerBar.cornerRadius = 8;
    trackerBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    trackerBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    trackerBar.top = "16px";
    trackerBar.isPointerBlocker = false;
    trackerBar.isHitTestVisible = false;
    trackerBar.clipChildren = true;
    this.advancedTexture.addControl(trackerBar);

    this.questTrackerText = new TextBlock("questTracker");
    this.questTrackerText.text = "";
    this.questTrackerText.color = "#a8d4ff";
    this.questTrackerText.fontSize = 16;
    this.questTrackerText.width = "96%";
    this.questTrackerText.height = "100%";
    this.questTrackerText.textWrapping = true;
    decorateHudText(this.questTrackerText);
    trackerBar.addControl(this.questTrackerText);
  }

  private createToast(): void {
    this.toastText = new TextBlock("gameToast");
    this.toastText.text = "";
    this.toastText.color = GuiStyles.colors.text;
    this.toastText.fontSize = 28;
    this.toastText.width = "70%";
    this.toastText.height = "48px";
    this.toastText.top = "80px";
    this.toastText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.toastText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.toastText.isVisible = false;
    this.toastText.outlineWidth = 2;
    this.toastText.outlineColor = "black";
    decorateHudText(this.toastText);
    this.advancedTexture.addControl(this.toastText);
  }

  private createHelpPanel(): void {
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
    infoRect.isPointerBlocker = true;
    this.advancedTexture.addControl(infoRect);

    const infoText = new TextBlock("infoText");
    infoText.text =
      "Клавиатура:\n" +
      "W / S — вперёд / назад\n" +
      "A / D — рысканье\n" +
      "↑ ↓ ← → — тангаж и крен\n" +
      "R — сброс позиции\n\n" +
      "Геймпад:\n" +
      "Левый стик — тяга и рысканье\n" +
      "Правый стик — тангаж и крен\n\n" +
      "Квесты (3 задания по порядку):\n" +
      "1. Сканирование атмосферы — зона у планеты\n" +
      "2. Гоночный чекпоинт — 5 колец за 30 сек\n" +
      "3. Доставка — обычная или хрупкая посылка\n\n" +
      "Кнопка «Задания» — список выполненных.";
    infoText.color = GuiStyles.colors.text;
    infoText.fontSize = 16;
    infoText.textWrapping = true;
    infoText.width = "90%";
    infoText.height = "86%";
    infoText.top = "12px";
    infoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    decorateHudText(infoText);
    infoRect.addControl(infoText);

    const closeButton = Button.CreateSimpleButton("helpCloseButton", "X");
    closeButton.width = "32px";
    closeButton.height = "32px";
    closeButton.color = GuiStyles.colors.text;
    closeButton.background = GuiStyles.colors.danger;
    closeButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    closeButton.top = "8px";
    closeButton.left = "-8px";
    closeButton.onPointerClickObservable.add(() => {
      infoRect.isVisible = false;
    });
    infoRect.addControl(closeButton);

    this.helpButton.onPointerClickObservable.add(() => {
      infoRect.isVisible = true;
    });
  }
}
