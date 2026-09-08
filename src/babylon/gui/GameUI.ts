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
  createModalActionButton,
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
import { EnergyGaugeUI } from "./EnergyGaugeUI";
import { Scene } from "@babylonjs/core";

const FIRST_RUN_STORAGE_KEY = "galacticDelivery.firstRunDone";

type ToastVariant = "default" | "success" | "warning" | "danger";

/** Отступ toast от нижнего края экрана. */
const TOAST_BOTTOM_OFFSET = 24;
const TOAST_PANEL_HEIGHT = 72;
const TOAST_STACK_GAP = 10;

function toastTopFromBottom(stackIndex: number): string {
  const offset =
    TOAST_BOTTOM_OFFSET +
    stackIndex * (TOAST_PANEL_HEIGHT + TOAST_STACK_GAP);
  return `-${offset + TOAST_PANEL_HEIGHT}px`;
}

function applyToastVariant(
  panel: Rectangle,
  text: TextBlock,
  variant: ToastVariant
): void {
  switch (variant) {
    case "success":
      panel.background = "rgba(18, 72, 52, 0.94)";
      panel.color = GuiStyles.colors.success;
      text.color = "#eafff3";
      break;
    case "warning":
      panel.background = "rgba(72, 56, 8, 0.94)";
      panel.color = "#ffb347";
      text.color = "#fff3cc";
      break;
    case "danger":
      panel.background = "rgba(80, 12, 20, 0.94)";
      panel.color = GuiStyles.colors.danger;
      text.color = "#ffe8ec";
      break;
    default:
      panel.background = GuiStyles.colors.panelBg;
      panel.color = GuiStyles.colors.borderBright;
      text.color = GuiStyles.colors.text;
      break;
  }
}

export class GameUI {
  private transientToastPanel!: Rectangle;
  private transientToastText!: TextBlock;
  private energyStatusPanel!: Rectangle;
  private energyStatusText!: TextBlock;
  private energyAlertPanel!: Rectangle;
  private energyAlertText!: TextBlock;
  private energyWarnBand: "ok" | "low" | "empty" = "ok";
  private lastEnergyPercent = 100;
  private helpButton!: Button;
  private helpOverlay!: Rectangle;
  private firstRunOverlay!: Rectangle;
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
  private energyGauge!: EnergyGaugeUI;
  private messageTimeout?: ReturnType<typeof setTimeout>;
  private domAlertTimer?: ReturnType<typeof setTimeout>;
  private domAlertEl: HTMLDivElement | null = null;

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

    this.keyboardDisplay = new KeyboardInputDisplayUI(this.advancedTexture);
    this.keyboardDisplay.initialize();

    this.speedometer = new SpeedometerUI(this.advancedTexture);
    this.speedometer.initialize();

    this.energyGauge = new EnergyGaugeUI(this.advancedTexture);
    this.energyGauge.initialize();

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
    this.createFirstRunOverlay();
    this.settingsMenu.finalize();

    // После всего HUD — toast и энергия поверх остальных элементов.
    this.createEnergyAlert();
    this.createEnergyStatusPanel();
    this.createTransientToast();

    bindHudResize(this.advancedTexture, (scale) => {
      this.keyboardDisplay.applyScale(scale);
      this.speedometer.applyScale(scale);
      this.energyGauge.applyScale(scale);
    });
  }

  updateSpeedometer(
    speed: number,
    maxSpeed: number,
    energyPercent = 100,
    _crates = 0
  ): void {
    this.speedometer.update(speed, maxSpeed);
    this.energyGauge.update(energyPercent);
    this.updateEnergyWarning(energyPercent);
  }

  /** Предупреждение энергии: постоянный gameToastPanel при ≤25% и 0%. */
  updateEnergyWarning(energyPercent: number): void {
    this.lastEnergyPercent = energyPercent;
    const energy = Math.round(energyPercent);
    let band: "ok" | "low" | "empty" = "ok";
    if (energy <= 0) band = "empty";
    else if (energy <= 25) band = "low";

    if (band !== this.energyWarnBand) {
      this.energyWarnBand = band;
    }

    this.syncEnergyToast(band);
  }

  /** Постоянная панель gameToastPanel при ≤25% и 0%. */
  private syncEnergyToast(band: "ok" | "low" | "empty"): void {
    if (band === "ok") {
      this.energyStatusPanel.isVisible = false;
      this.energyStatusPanel.alpha = 0;
      return;
    }

    this.energyStatusText.text = this.getEnergyToastText(band);
    this.energyStatusPanel.alpha = 1;
    this.energyStatusPanel.isVisible = true;
    applyToastVariant(
      this.energyStatusPanel,
      this.energyStatusText,
      band === "empty" ? "danger" : "warning"
    );
  }

  private getEnergyToastText(band: "low" | "empty"): string {
    if (band === "empty") {
      return "Заряд исчерпан. Нажмите R, чтобы перезапустить игру.";
    }
    return "Внимание: низкий заряд энергии!";
  }

  /** Toast в стиле gameToastPanel при выполнении задания. */
  showQuestCompleteToast(questTitle: string, duration = 5500): void {
    this.showMessage(
      `«${questTitle}» — задание выполнено!`,
      duration,
      "success"
    );
  }

  /**
   * Важное оповещение: DOM поверх canvas + Babylon toast/баннер.
   * Не перекрывается предупреждениями энергии, пока не истечёт duration.
   */
  showPriorityAlert(text: string, duration = 6000): void {
    this.energyAlertText.text = text;
    this.energyAlertText.color = "#ffe8ec";
    this.energyAlertPanel.background = "rgba(80, 12, 20, 0.96)";
    this.energyAlertPanel.color = GuiStyles.colors.danger;
    this.energyAlertPanel.width = "min(640px, 92%)";
    this.energyAlertPanel.alpha = 1;
    this.energyAlertPanel.isVisible = true;

    this.questHud.showAlert(text);
    this.showMessage(text, duration);
    this.showDomAlert(text, duration);

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    this.messageTimeout = setTimeout(() => {
      this.messageTimeout = undefined;
      this.energyAlertPanel.isVisible = false;
      this.energyAlertPanel.alpha = 0;
      this.questHud.clearAlert();
      this.updateEnergyWarning(this.lastEnergyPercent);
    }, duration);
  }

  private showDomAlert(text: string, duration: number): void {
    if (typeof document === "undefined") return;

    if (!this.domAlertEl) {
      const el = document.createElement("div");
      el.id = "galactic-delivery-priority-alert";
      el.setAttribute("role", "alert");
      el.style.cssText = [
        "position:fixed",
        "top:28px",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "max-width:min(640px,92vw)",
        "padding:14px 22px",
        "border-radius:14px",
        "background:rgba(80,12,20,0.96)",
        "border:2px solid #ff5c6c",
        "color:#ffe8ec",
        "font:700 18px/1.35 Segoe UI,system-ui,sans-serif",
        "text-align:center",
        "pointer-events:none",
        "box-shadow:0 8px 28px rgba(0,0,0,0.45)",
      ].join(";");
      document.body.appendChild(el);
      this.domAlertEl = el;
    }

    this.domAlertEl.textContent = text;
    this.domAlertEl.style.display = "block";

    if (this.domAlertTimer) {
      clearTimeout(this.domAlertTimer);
    }
    this.domAlertTimer = setTimeout(() => {
      if (this.domAlertEl) {
        this.domAlertEl.style.display = "none";
      }
      this.domAlertTimer = undefined;
    }, duration);
  }

  /** Сброс баннера при перезапуске (R). */
  resetEnergyWarning(): void {
    this.energyWarnBand = "ok";
    this.energyStatusPanel.isVisible = false;
    this.energyStatusPanel.alpha = 0;
    this.energyAlertPanel.isVisible = false;
    this.energyAlertPanel.alpha = 0;
    if (this.domAlertEl) {
      this.domAlertEl.style.display = "none";
    }
    if (this.domAlertTimer) {
      clearTimeout(this.domAlertTimer);
      this.domAlertTimer = undefined;
    }
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = undefined;
    }
    this.transientToastPanel.isVisible = false;
    this.transientToastText.text = "";
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
      this.firstRunOverlay.isVisible ||
      this.settingsMenu.isOpen() ||
      this.questDialog.isOpen() ||
      this.packageChoice.isOpen() ||
      this.completionScreen.isOpen()
    );
  }

  /**
   * Показать введение один раз после первой загрузки
   * (localStorage: galacticDelivery.firstRunDone).
   */
  showFirstRunIfNeeded(): void {
    try {
      if (localStorage.getItem(FIRST_RUN_STORAGE_KEY) === "1") return;
    } catch {
      /* private mode — всё равно покажем */
    }
    this.firstRunOverlay.isVisible = true;
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

  showMessage(
    text: string,
    duration = 3000,
    variant: ToastVariant = "default"
  ): void {
    if (!text) return;

    this.transientToastText.text = text;
    applyToastVariant(this.transientToastPanel, this.transientToastText, variant);
    this.transientToastPanel.top = this.getTransientToastTop();
    this.transientToastPanel.alpha = 1;
    this.transientToastPanel.isVisible = true;

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = setTimeout(() => {
      this.transientToastPanel.isVisible = false;
      this.transientToastText.text = "";
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

  private getTransientToastTop(): string {
    const stackIndex = this.energyStatusPanel.isVisible ? 1 : 0;
    return toastTopFromBottom(stackIndex);
  }

  private createTransientToast(): void {
    this.transientToastPanel = createGlassPanel(
      "gameToastPanel",
      "640px",
      TOAST_PANEL_HEIGHT,
      true
    );
    this.transientToastPanel.horizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.transientToastPanel.verticalAlignment =
      Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.transientToastPanel.top = toastTopFromBottom(0);
    this.transientToastPanel.zIndex = 960;
    this.transientToastPanel.clipChildren = false;
    this.transientToastPanel.isVisible = false;
    this.transientToastPanel.isHitTestVisible = false;
    this.advancedTexture.addControl(this.transientToastPanel);

    this.transientToastText = new TextBlock("gameToast");
    this.transientToastText.text = "";
    this.transientToastText.width = "94%";
    this.transientToastText.height = "68px";
    this.transientToastText.fontSize = GuiStyles.fontSize.message;
    this.transientToastText.fontWeight = "600";
    this.transientToastText.textHorizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.transientToastText.textVerticalAlignment =
      Control.VERTICAL_ALIGNMENT_CENTER;
    this.transientToastText.color = GuiStyles.colors.text;
    this.transientToastText.textWrapping = true;
    this.transientToastText.isHitTestVisible = false;
    this.transientToastPanel.addControl(this.transientToastText);
  }

  /** Постоянное предупреждение энергии — тот же стиль, что gameToastPanel. */
  private createEnergyStatusPanel(): void {
    this.energyStatusPanel = createGlassPanel(
      "energyStatusPanel",
      "640px",
      TOAST_PANEL_HEIGHT,
      true
    );
    this.energyStatusPanel.horizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.energyStatusPanel.verticalAlignment =
      Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.energyStatusPanel.top = toastTopFromBottom(0);
    this.energyStatusPanel.zIndex = 955;
    this.energyStatusPanel.clipChildren = false;
    this.energyStatusPanel.isVisible = false;
    this.energyStatusPanel.isHitTestVisible = false;
    this.advancedTexture.addControl(this.energyStatusPanel);

    this.energyStatusText = new TextBlock("energyStatusText");
    this.energyStatusText.text = "";
    this.energyStatusText.width = "94%";
    this.energyStatusText.height = "68px";
    this.energyStatusText.fontSize = GuiStyles.fontSize.message;
    this.energyStatusText.fontWeight = "600";
    this.energyStatusText.textHorizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.energyStatusText.textVerticalAlignment =
      Control.VERTICAL_ALIGNMENT_CENTER;
    this.energyStatusText.color = GuiStyles.colors.text;
    this.energyStatusText.textWrapping = true;
    this.energyStatusText.isHitTestVisible = false;
    this.energyStatusPanel.addControl(this.energyStatusText);
  }

  private createEnergyAlert(): void {
    this.energyAlertPanel = new Rectangle("energyAlertPanel");
    this.energyAlertPanel.width = "min(560px, 90%)";
    this.energyAlertPanel.height = "76px";
    this.energyAlertPanel.thickness = 2;
    this.energyAlertPanel.cornerRadius = GuiStyles.radius.lg;
    this.energyAlertPanel.background = "rgba(60, 36, 8, 0.94)";
    this.energyAlertPanel.color = "#ffb347";
    this.energyAlertPanel.horizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.energyAlertPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.energyAlertPanel.top = "20px";
    this.energyAlertPanel.zIndex = 900;
    this.energyAlertPanel.clipChildren = false;
    this.energyAlertPanel.isVisible = false;
    this.energyAlertPanel.alpha = 0;
    this.energyAlertPanel.isHitTestVisible = false;
    this.energyAlertPanel.isPointerBlocker = false;
    this.advancedTexture.addControl(this.energyAlertPanel);

    this.energyAlertText = new TextBlock("energyAlertText", "");
    this.energyAlertText.width = "96%";
    this.energyAlertText.height = "72px";
    this.energyAlertText.fontSize = 20;
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

    const infoText = createModalBodyText("infoText", 420);
    infoText.fontSize = GuiStyles.fontSize.help;
    infoText.text =
      "Клавиатура:\n" +
      "W / S — вперёд / назад\n" +
      "A / D — рысканье\n" +
      "↑ ↓ ← → — тангаж и крен\n" +
      "1 — камера от первого лица\n" +
      "2 — камера от третьего лица\n" +
      "R — перезапуск (позиция и заряд)\n\n" +
      "Геймпад:\n" +
      "Левый стик — тяга и рысканье\n" +
      "Правый стик — тангаж и крен\n\n" +
      "Энергия:\n" +
      "Тратится в полёте. Контейнеры рядом с кораблём\n" +
      "пополняют заряд на 10%.";
    shell.body.height = "440px";
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

  private createFirstRunOverlay(): void {
    const shell = createModalShell(
      this.advancedTexture,
      "firstRun",
      540,
      420,
      { showClose: false, zIndex: 1100 }
    );
    this.firstRunOverlay = shell.overlay;
    shell.title.text = "Добро пожаловать";
    shell.body.height = "280px";

    const body = createModalBodyText("firstRunBody", 240);
    body.fontSize = GuiStyles.fontSize.help;
    body.text =
      "Вы курьер в открытом космосе.\n\n" +
      "1. Энергия тратится в полёте — на спидометре слева внизу.\n" +
      "2. Банки рядом с кораблём = +10% заряда.\n" +
      "3. Планеты с цветной атмосферой и кольцом — задания.\n" +
      "4. Маркер над кораблём ведёт к цели.\n\n" +
      "Управление: W A S D и стрелки. 1 / 2 — камера. R — рестарт.\n" +
      "Полный список — кнопка «?» справа сверху.";
    shell.body.addControl(body);

    const startBtn = createModalActionButton(
      "firstRunStart",
      "Понятно, летим!",
      "primary",
      200
    );
    startBtn.onPointerClickObservable.add(() => {
      this.dismissFirstRun();
    });
    shell.footer.addControl(startBtn);
  }

  private dismissFirstRun(): void {
    this.firstRunOverlay.isVisible = false;
    try {
      localStorage.setItem(FIRST_RUN_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }
}
