import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Ellipse,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { GuiStyles } from "./GuiStyles";
import type { QuestCompletionRecord } from "../quests/QuestStats";

export interface QuestDialogContent {
  title: string;
  description: string;
  destinationName?: string;
}

/**
 * Диалог принятия квеста при подлёте к планете-выдаче.
 */
export class QuestDialogUI {
  private overlay!: Rectangle;
  private titleText!: TextBlock;
  private bodyText!: TextBlock;
  private onAccept?: () => void;
  private onDecline?: () => void;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.overlay = new Rectangle("questDialogOverlay");
    this.overlay.width = "100%";
    this.overlay.height = "100%";
    this.overlay.thickness = 0;
    this.overlay.background = "rgba(0, 0, 0, 0.55)";
    this.overlay.isVisible = false;
    this.overlay.isPointerBlocker = true;
    this.advancedTexture.addControl(this.overlay);

    const panel = new Rectangle("questDialogPanel");
    panel.width = "520px";
    panel.height = "340px";
    panel.cornerRadius = 12;
    panel.color = GuiStyles.colors.accent;
    panel.thickness = 2;
    panel.background = GuiStyles.colors.cardBg;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.overlay.addControl(panel);

    this.titleText = new TextBlock("questDialogTitle");
    this.titleText.height = "48px";
    this.titleText.color = GuiStyles.colors.text;
    this.titleText.fontSize = GuiStyles.fontSize.title;
    this.titleText.fontWeight = "bold";
    this.titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.titleText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.titleText.paddingTop = "20px";
    panel.addControl(this.titleText);

    this.bodyText = new TextBlock("questDialogBody");
    this.bodyText.width = "460px";
    this.bodyText.height = "170px";
    this.bodyText.color = GuiStyles.colors.text;
    this.bodyText.fontSize = GuiStyles.fontSize.label;
    this.bodyText.textWrapping = true;
    this.bodyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.bodyText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.bodyText.top = "12px";
    this.bodyText.isHitTestVisible = false;
    panel.addControl(this.bodyText);

    const buttons = new StackPanel("questDialogButtons");
    buttons.isVertical = false;
    buttons.height = "52px";
    buttons.spacing = 16;
    buttons.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    buttons.paddingBottom = "18px";
    panel.addControl(buttons);

    const declineBtn = Button.CreateSimpleButton("questDeclineBtn", "Позже");
    declineBtn.width = "120px";
    declineBtn.height = "44px";
    declineBtn.color = GuiStyles.colors.text;
    declineBtn.background = GuiStyles.colors.sliderBg;
    declineBtn.cornerRadius = 6;
    declineBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onDecline?.();
    });
    buttons.addControl(declineBtn);

    const acceptBtn = Button.CreateSimpleButton("questAcceptBtn", "Принять");
    acceptBtn.width = "160px";
    acceptBtn.height = "44px";
    acceptBtn.color = GuiStyles.colors.text;
    acceptBtn.background = GuiStyles.colors.accent;
    acceptBtn.cornerRadius = 6;
    acceptBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onAccept?.();
    });
    buttons.addControl(acceptBtn);
  }

  show(
    content: QuestDialogContent,
    onAccept: () => void,
    onDecline?: () => void
  ): void {
    this.onAccept = onAccept;
    this.onDecline = onDecline;
    this.titleText.text = content.title;
    const destLine = content.destinationName
      ? `\n\nПланета назначения: ${content.destinationName}`
      : "";
    this.bodyText.text = `${content.description}${destLine}`;
    this.overlay.isVisible = true;
  }

  hide(): void {
    this.overlay.isVisible = false;
  }

  isOpen(): boolean {
    return this.overlay.isVisible;
  }
}

/**
 * Круговой прогресс сканирования: дуга заполняется, по завершении — галочка.
 */
export class ScanProgressUI {
  private container!: Rectangle;
  private track!: Ellipse;
  private progressArc!: Ellipse;
  private checkmark!: TextBlock;
  private label!: TextBlock;
  private completed = false;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.container = new Rectangle("scanProgressContainer");
    this.container.width = "140px";
    this.container.height = "120px";
    this.container.thickness = 0;
    this.container.background = "transparent";
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.container.top = "-24px";
    this.container.isVisible = false;
    this.container.isPointerBlocker = false;
    this.container.isHitTestVisible = false;
    this.advancedTexture.addControl(this.container);

    this.track = new Ellipse("scanProgressTrack");
    this.track.width = "88px";
    this.track.height = "88px";
    this.track.thickness = 6;
    this.track.color = "rgba(255,255,255,0.25)";
    this.track.background = "rgba(0,0,0,0.45)";
    this.container.addControl(this.track);

    this.progressArc = new Ellipse("scanProgressArc");
    this.progressArc.width = "88px";
    this.progressArc.height = "88px";
    this.progressArc.thickness = 6;
    this.progressArc.color = GuiStyles.colors.accent;
    this.progressArc.background = "transparent";
    this.progressArc.arc = 0;
    this.container.addControl(this.progressArc);

    this.checkmark = new TextBlock("scanProgressCheck");
    this.checkmark.text = "✓";
    this.checkmark.color = "#5dffb0";
    this.checkmark.fontSize = 42;
    this.checkmark.fontWeight = "bold";
    this.checkmark.isVisible = false;
    this.container.addControl(this.checkmark);

    this.label = new TextBlock("scanProgressLabel");
    this.label.text = "Сканирование";
    this.label.color = GuiStyles.colors.text;
    this.label.fontSize = 13;
    this.label.width = "140px";
    this.label.height = "20px";
    this.label.top = "58px";
    this.label.isHitTestVisible = false;
    this.container.addControl(this.label);
  }

  setVisible(value: boolean): void {
    this.container.isVisible = value;
    if (!value) {
      this.reset();
    }
  }

  setProgress(progress: number): void {
    if (this.completed) return;
    const clamped = Math.max(0, Math.min(1, progress));
    this.progressArc.arc = clamped;
    this.progressArc.isVisible = clamped > 0;
    this.label.text =
      clamped > 0 && clamped < 1
        ? `Сканирование ${Math.round(clamped * 100)}%`
        : "Сканирование";
  }

  showComplete(): void {
    this.completed = true;
    this.progressArc.isVisible = false;
    this.track.color = "#5dffb0";
    this.checkmark.isVisible = true;
    this.label.text = "Готово";
  }

  reset(): void {
    this.completed = false;
    this.progressArc.arc = 0;
    this.progressArc.isVisible = false;
    this.progressArc.color = GuiStyles.colors.accent;
    this.track.color = "rgba(255,255,255,0.25)";
    this.checkmark.isVisible = false;
    this.label.text = "Сканирование";
  }
}

/** HUD таймера / счётчика колец / доставки */
export class QuestHudUI {
  private container!: Rectangle;
  private label!: TextBlock;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.container = new Rectangle("questHud");
    this.container.width = "360px";
    this.container.height = "40px";
    this.container.thickness = 0;
    this.container.background = "rgba(0,0,0,0.6)";
    this.container.cornerRadius = 8;
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.container.top = "-150px";
    this.container.isVisible = false;
    this.container.isPointerBlocker = false;
    this.container.clipChildren = true;
    this.advancedTexture.addControl(this.container);

    this.label = new TextBlock("questHudLabel");
    this.label.color = GuiStyles.colors.text;
    this.label.fontSize = 18;
    this.label.width = "100%";
    this.label.height = "100%";
    this.label.textWrapping = false;
    this.label.isHitTestVisible = false;
    this.container.addControl(this.label);
  }

  setVisible(v: boolean): void {
    this.container.isVisible = v;
    if (!v) {
      this.label.text = "";
    }
  }

  setText(text: string): void {
    if (this.label.text === text) return;
    this.label.text = text;
  }
}

/** Выбор типа посылки */
export class PackageChoiceDialogUI {
  private overlay!: Rectangle;
  private onSimple?: () => void;
  private onFragile?: () => void;
  private onCancel?: () => void;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.overlay = new Rectangle("packageChoiceOverlay");
    this.overlay.width = "100%";
    this.overlay.height = "100%";
    this.overlay.thickness = 0;
    this.overlay.background = "rgba(0,0,0,0.55)";
    this.overlay.isVisible = false;
    this.overlay.isPointerBlocker = true;
    this.advancedTexture.addControl(this.overlay);

    const panel = new Rectangle("packageChoicePanel");
    panel.width = "500px";
    panel.height = "300px";
    panel.cornerRadius = 12;
    panel.color = GuiStyles.colors.accent;
    panel.thickness = 2;
    panel.background = GuiStyles.colors.cardBg;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.overlay.addControl(panel);

    const title = new TextBlock("packageTitle");
    title.text = "Выберите посылку";
    title.color = GuiStyles.colors.text;
    title.fontSize = GuiStyles.fontSize.title;
    title.paddingTop = "24px";
    title.height = "48px";
    panel.addControl(title);

    const body = new TextBlock("packageBody");
    body.text =
      "Обычная — без таймера, летите в своём темпе.\n" +
      "Хрупкая — доставьте за 2 мин, избегайте резких разгонов.";
    body.color = GuiStyles.colors.text;
    body.fontSize = GuiStyles.fontSize.label;
    body.textWrapping = true;
    body.width = "440px";
    body.height = "90px";
    body.top = "8px";
    body.isHitTestVisible = false;
    panel.addControl(body);

    const buttons = new StackPanel("packageButtons");
    buttons.isVertical = false;
    buttons.height = "52px";
    buttons.spacing = 16;
    buttons.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    buttons.paddingBottom = "20px";
    panel.addControl(buttons);

    const simpleBtn = Button.CreateSimpleButton("pkgSimple", "Обычная");
    simpleBtn.width = "150px";
    simpleBtn.height = "44px";
    simpleBtn.color = GuiStyles.colors.text;
    simpleBtn.background = GuiStyles.colors.accent;
    simpleBtn.cornerRadius = 6;
    simpleBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onSimple?.();
    });
    buttons.addControl(simpleBtn);

    const fragileBtn = Button.CreateSimpleButton("pkgFragile", "Хрупкая");
    fragileBtn.width = "150px";
    fragileBtn.height = "44px";
    fragileBtn.color = GuiStyles.colors.text;
    fragileBtn.background = "#e67e22";
    fragileBtn.cornerRadius = 6;
    fragileBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onFragile?.();
    });
    buttons.addControl(fragileBtn);

    const cancelBtn = Button.CreateSimpleButton("pkgCancel", "Отмена");
    cancelBtn.width = "90px";
    cancelBtn.height = "32px";
    cancelBtn.color = GuiStyles.colors.text;
    cancelBtn.background = GuiStyles.colors.sliderBg;
    cancelBtn.cornerRadius = 6;
    cancelBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    cancelBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    cancelBtn.top = "10px";
    cancelBtn.left = "-10px";
    cancelBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onCancel?.();
    });
    panel.addControl(cancelBtn);
  }

  show(
    onSimple: () => void,
    onFragile: () => void,
    onCancel?: () => void
  ): void {
    this.onSimple = onSimple;
    this.onFragile = onFragile;
    this.onCancel = onCancel;
    this.overlay.isVisible = true;
  }

  hide(): void {
    this.overlay.isVisible = false;
  }

  isOpen(): boolean {
    return this.overlay.isVisible;
  }
}

/** Список выполненных заданий */
export class QuestCompletedListUI {
  private overlay!: Rectangle;
  private listText!: TextBlock;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.overlay = new Rectangle("questListOverlay");
    this.overlay.width = "100%";
    this.overlay.height = "100%";
    this.overlay.thickness = 0;
    this.overlay.background = "rgba(0,0,0,0.55)";
    this.overlay.isVisible = false;
    this.overlay.isPointerBlocker = true;
    this.advancedTexture.addControl(this.overlay);

    const panel = new Rectangle("questListPanel");
    panel.width = "520px";
    panel.height = "400px";
    panel.cornerRadius = 12;
    panel.color = GuiStyles.colors.accent;
    panel.thickness = 2;
    panel.background = GuiStyles.colors.cardBg;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.overlay.addControl(panel);

    const title = new TextBlock("questListTitle");
    title.text = "Выполненные задания";
    title.color = GuiStyles.colors.text;
    title.fontSize = GuiStyles.fontSize.title;
    title.height = "50px";
    title.paddingTop = "20px";
    panel.addControl(title);

    this.listText = new TextBlock("questListBody");
    this.listText.width = "460px";
    this.listText.height = "260px";
    this.listText.color = GuiStyles.colors.text;
    this.listText.fontSize = GuiStyles.fontSize.label;
    this.listText.textWrapping = true;
    this.listText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.listText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.listText.top = "20px";
    this.listText.isHitTestVisible = false;
    panel.addControl(this.listText);

    const closeBtn = Button.CreateSimpleButton("questListClose", "Закрыть");
    closeBtn.width = "120px";
    closeBtn.height = "40px";
    closeBtn.color = GuiStyles.colors.text;
    closeBtn.background = GuiStyles.colors.accent;
    closeBtn.cornerRadius = 6;
    closeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeBtn.paddingBottom = "20px";
    closeBtn.onPointerClickObservable.add(() => this.hide());
    panel.addControl(closeBtn);
  }

  show(records: readonly QuestCompletionRecord[], formatTime: (s: number) => string): void {
    if (records.length === 0) {
      this.listText.text = "Пока нет выполненных заданий.";
    } else {
      this.listText.text = records
        .map(
          (r, i) =>
            `${i + 1}. ${r.title} ✓\n` +
            `   Время: ${formatTime(r.elapsedSeconds)} | Чистота: ${r.cleanliness}%\n` +
            (r.detail ? `   ${r.detail}\n` : "")
        )
        .join("\n");
    }
    this.overlay.isVisible = true;
  }

  hide(): void {
    this.overlay.isVisible = false;
  }
}

/** Финальный экран после всех трёх квестов */
export class GameCompletionUI {
  private overlay!: Rectangle;
  private statsText!: TextBlock;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.overlay = new Rectangle("gameCompletionOverlay");
    this.overlay.width = "100%";
    this.overlay.height = "100%";
    this.overlay.thickness = 0;
    this.overlay.background = "rgba(0, 0, 0, 0.88)";
    this.overlay.isVisible = false;
    this.overlay.isPointerBlocker = true;
    this.advancedTexture.addControl(this.overlay);

    const panel = new Rectangle("gameCompletionPanel");
    panel.width = "560px";
    panel.height = "480px";
    panel.cornerRadius = 14;
    panel.color = "#5dffb0";
    panel.thickness = 3;
    panel.background = GuiStyles.colors.cardBg;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.overlay.addControl(panel);

    const title = new TextBlock("completionTitle");
    title.text = "Все задания выполнены!";
    title.color = "#5dffb0";
    title.fontSize = 32;
    title.fontWeight = "bold";
    title.height = "56px";
    title.paddingTop = "28px";
    panel.addControl(title);

    this.statsText = new TextBlock("completionStats");
    this.statsText.width = "480px";
    this.statsText.height = "280px";
    this.statsText.color = GuiStyles.colors.text;
    this.statsText.fontSize = 18;
    this.statsText.textWrapping = true;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statsText.top = "24px";
    this.statsText.isHitTestVisible = false;
    panel.addControl(this.statsText);

    const closeBtn = Button.CreateSimpleButton("completionClose", "Отлично!");
    closeBtn.width = "160px";
    closeBtn.height = "46px";
    closeBtn.color = GuiStyles.colors.text;
    closeBtn.background = GuiStyles.colors.accent;
    closeBtn.cornerRadius = 8;
    closeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeBtn.paddingBottom = "24px";
    closeBtn.onPointerClickObservable.add(() => this.hide());
    panel.addControl(closeBtn);
  }

  show(stats: {
    time: string;
    distance: string;
    cleanliness: number;
    quests: readonly QuestCompletionRecord[];
  }): void {
    const questLines = stats.quests
      .map((q) => `• ${q.title} — ${q.cleanliness}%`)
      .join("\n");
    this.statsText.text =
      `Общее время: ${stats.time}\n` +
      `Пройдено: ${stats.distance}\n` +
      `Чистота выполнения: ${stats.cleanliness}%\n\n` +
      `Задания:\n${questLines}`;
    this.overlay.isVisible = true;
  }

  hide(): void {
    this.overlay.isVisible = false;
  }
}
