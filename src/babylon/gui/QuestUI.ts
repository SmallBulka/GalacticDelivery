import {
  AdvancedDynamicTexture,
  Control,
  Ellipse,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import { GuiStyles } from "./GuiStyles";
import {
  createModalActionButton,
  createModalBodyText,
  createModalShell,
  MODAL_Z_INDEX,
} from "./GuiHelpers";
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
    const shell = createModalShell(
      this.advancedTexture,
      "questDialog",
      520,
      360,
      { zIndex: MODAL_Z_INDEX, showClose: false }
    );
    this.overlay = shell.overlay;
    this.titleText = shell.title;

    this.bodyText = createModalBodyText("questDialogBody", 180);
    shell.body.addControl(this.bodyText);

    const declineBtn = createModalActionButton(
      "questDeclineBtn",
      "Позже",
      "secondary",
      130
    );
    declineBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onDecline?.();
    });
    shell.footer.addControl(declineBtn);

    const acceptBtn = createModalActionButton(
      "questAcceptBtn",
      "Принять",
      "primary",
      160
    );
    acceptBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onAccept?.();
    });
    shell.footer.addControl(acceptBtn);
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
    this.checkmark.color = GuiStyles.colors.success;
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
    this.track.color = GuiStyles.colors.success;
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
    this.container.thickness = 1;
    this.container.color = GuiStyles.colors.border;
    this.container.background = GuiStyles.colors.panelBg;
    this.container.cornerRadius = GuiStyles.radius.md;
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
    const shell = createModalShell(
      this.advancedTexture,
      "packageChoice",
      520,
      320,
      { zIndex: MODAL_Z_INDEX }
    );
    this.overlay = shell.overlay;
    shell.title.text = "Выберите посылку";
    shell.closeButton.onPointerClickObservable.add(() => {
      this.hide();
      this.onCancel?.();
    });

    const body = createModalBodyText("packageBody", 110);
    body.text =
      "Обычная — без таймера, летите в своём темпе.\n\n" +
      "Хрупкая — доставьте за 2 мин, избегайте резких разгонов.";
    shell.body.addControl(body);

    const simpleBtn = createModalActionButton(
      "pkgSimple",
      "Обычная",
      "primary",
      150
    );
    simpleBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onSimple?.();
    });
    shell.footer.addControl(simpleBtn);

    const fragileBtn = createModalActionButton(
      "pkgFragile",
      "Хрупкая",
      "warning",
      150
    );
    fragileBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onFragile?.();
    });
    shell.footer.addControl(fragileBtn);

    const cancelBtn = createModalActionButton(
      "pkgCancel",
      "Отмена",
      "secondary",
      110
    );
    cancelBtn.onPointerClickObservable.add(() => {
      this.hide();
      this.onCancel?.();
    });
    shell.footer.addControl(cancelBtn);
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
    const shell = createModalShell(
      this.advancedTexture,
      "questList",
      520,
      420,
      { zIndex: MODAL_Z_INDEX }
    );
    this.overlay = shell.overlay;
    shell.title.text = "Выполненные задания";
    shell.closeButton.onPointerClickObservable.add(() => this.hide());

    this.listText = createModalBodyText("questListBody", 260);
    shell.body.addControl(this.listText);

    // const closeBtn = createModalActionButton(
    //   "questListClose",
    //   "Закрыть",
    //   "primary",
    //   140
    // );
    // closeBtn.onPointerClickObservable.add(() => this.hide());
    // shell.footer.addControl(closeBtn);
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
    const shell = createModalShell(
      this.advancedTexture,
      "gameCompletion",
      560,
      480,
      { zIndex: MODAL_Z_INDEX, showClose: false }
    );
    this.overlay = shell.overlay;
    shell.title.text = "Все задания выполнены!";
    shell.title.color = GuiStyles.colors.success;

    this.statsText = createModalBodyText("completionStats", 280);
    this.statsText.fontSize = 17;
    shell.body.addControl(this.statsText);

    const closeBtn = createModalActionButton(
      "completionClose",
      "Отлично!",
      "primary",
      160
    );
    closeBtn.onPointerClickObservable.add(() => this.hide());
    shell.footer.addControl(closeBtn);
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
