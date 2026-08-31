import {
  AdvancedDynamicTexture,
  Button,
  Control,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { GuiStyles } from "./GuiStyles";
import {
  createGlassPanel,
  createVerticalStack,
  styleSectionHeader,
  bindUiClickSound,
} from "./GuiHelpers";
import { ALL_QUESTS, QuestId, QuestPhase } from "../quests/QuestTypes";

export interface QuestListItemState {
  id: QuestId;
  title: string;
  phase: QuestPhase;
  selected: boolean;
}

/**
 * Список всех заданий слева: переключение, галочка у завершённых.
 */
export class QuestSwitcherUI {
  private buttons = new Map<QuestId, Button>();
  private onSelect?: (id: QuestId) => void;

  constructor(_advancedTexture: AdvancedDynamicTexture) {}

  initialize(parent: StackPanel): void {
    const bar = createGlassPanel("questTrackerBar", "100%", 196);
    bar.isPointerBlocker = false;
    parent.addControl(bar);

    const inner = createVerticalStack("questSwitcherInner", GuiStyles.spacing.sm);
    inner.width = "94%";
    inner.paddingTop = "10px";
    inner.paddingBottom = "10px";
    bar.addControl(inner);

    const header = new TextBlock("questSwitcherHeader");
    styleSectionHeader(header, "ЗАДАНИЯ");
    header.width = "100%";
    header.paddingLeft = "15px";
    inner.addControl(header);

    for (const quest of ALL_QUESTS) {
      const btn = Button.CreateSimpleButton(`questSwitch_${quest.id}`, quest.title);
      btn.textBlock!.paddingLeft = "15px";
      btn.width = "100%";
      btn.height = `${GuiStyles.button.heightSm + 4}px`;
      btn.cornerRadius = GuiStyles.button.cornerRadius;
      btn.thickness = 1;
      btn.fontSize = GuiStyles.fontSize.body;
      btn.paddingLeft = "10px";
      btn.paddingRight = "10px";
      btn.textBlock!.textWrapping = true;
      btn.textBlock!.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      btn.isPointerBlocker = true;
      btn.onPointerClickObservable.add(() => {
        if (!btn.isEnabled) return;
        this.onSelect?.(quest.id);
      });
      bindUiClickSound(btn);
      this.buttons.set(quest.id, btn);
      inner.addControl(btn);
    }
  }

  setSelectHandler(handler: (id: QuestId) => void): void {
    this.onSelect = handler;
  }

  refresh(items: QuestListItemState[]): void {
    for (const item of items) {
      const btn = this.buttons.get(item.id);
      if (!btn) continue;

      const done = item.phase === QuestPhase.Completed;
      btn.textBlock!.text = done ? `✓  ${item.title}` : item.title;
      btn.isEnabled = !done;

      if (done) {
        btn.background = GuiStyles.colors.buttonDone;
        btn.color = GuiStyles.colors.success;
        btn.thickness = 1;
        btn.textBlock!.color = GuiStyles.colors.success;
      } else if (item.selected) {
        btn.background = GuiStyles.colors.buttonActive;
        btn.color = GuiStyles.colors.borderBright;
        btn.thickness = 2;
        btn.textBlock!.color = GuiStyles.colors.text;
      } else {
        btn.background = GuiStyles.colors.buttonIdle;
        btn.color = GuiStyles.colors.border;
        btn.thickness = 1;
        btn.textBlock!.color = GuiStyles.colors.textMuted;
      }
    }
  }
}
