import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { GuiStyles } from "./GuiStyles";

/** z-index модальных окон — поверх всего HUD */
export const MODAL_Z_INDEX = 1000;

export function getHudScale(texture: AdvancedDynamicTexture): number {
  const w = texture.getSize().width;
  if (w <= 1024) return 0.84;
  if (w <= 1366) return 0.92;
  return 1;
}

export function bindHudResize(
  texture: AdvancedDynamicTexture,
  onResize: (scale: number, width: number, height: number) => void
): void {
  const fire = () => {
    const size = texture.getSize();
    onResize(getHudScale(texture), size.width, size.height);
  };
  window.addEventListener("resize", fire);
  fire();
}

export function createGlassPanel(
  name: string,
  width: string | number,
  height: string | number,
  bright = false
): Rectangle {
  const panel = new Rectangle(name);
  panel.width = typeof width === "number" ? `${width}px` : width;
  panel.height = typeof height === "number" ? `${height}px` : height;
  panel.thickness = bright ? 2 : 1;
  panel.color = bright ? GuiStyles.colors.borderBright : GuiStyles.colors.border;
  panel.background = GuiStyles.colors.panelBg;
  panel.cornerRadius = GuiStyles.radius.lg;
  panel.isHitTestVisible = false;
  panel.isPointerBlocker = bright;
  return panel;
}

export function stylePrimaryButton(button: Button): void {
  button.height = `${GuiStyles.button.height}px`;
  button.cornerRadius = GuiStyles.button.cornerRadius;
  button.background = GuiStyles.colors.accentDark;
  button.thickness = 1;
  button.color = GuiStyles.colors.borderBright;
  button.fontSize = GuiStyles.fontSize.body;
  button.fontWeight = "600";
  button.paddingLeft = "12px";
  button.paddingRight = "12px";
  if (button.textBlock) {
    button.textBlock.color = GuiStyles.colors.text;
  }
}

export function styleSecondaryButton(button: Button): void {
  button.height = `${GuiStyles.button.heightSm}px`;
  button.cornerRadius = GuiStyles.button.cornerRadius;
  button.color = GuiStyles.colors.text;
  button.background = GuiStyles.colors.buttonIdle;
  button.thickness = 1;
  button.color = GuiStyles.colors.border;
  button.fontSize = GuiStyles.fontSize.body;
  button.paddingLeft = "10px";
  button.paddingRight = "10px";
}

export function styleGhostButton(button: Button): void {
  styleSecondaryButton(button);
  button.background = GuiStyles.colors.panelBgLight;
}

export function styleSectionHeader(text: TextBlock, value: string): TextBlock {
  text.text = value;
  text.color = GuiStyles.colors.accentBright;
  text.fontSize = GuiStyles.fontSize.caption;
  text.fontWeight = "700";
  text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  text.height = "18px";
  text.textWrapping = false;
  text.isHitTestVisible = false;
  return text;
}

export function styleHudText(text: TextBlock, options?: { muted?: boolean; bold?: boolean }): void {
  text.color = options?.muted ? GuiStyles.colors.textMuted : GuiStyles.colors.text;
  text.fontSize = GuiStyles.fontSize.body;
  text.textWrapping = true;
  text.isHitTestVisible = false;
  text.isPointerBlocker = false;
  if (options?.bold) text.fontWeight = "600";
}

export function styleValueText(text: TextBlock): void {
  text.color = GuiStyles.colors.text;
  text.fontSize = GuiStyles.fontSize.score;
  text.fontWeight = "600";
  text.textWrapping = false;
  text.isHitTestVisible = false;
}

export function createVerticalStack(
  name: string,
  spacing: number = GuiStyles.spacing.sm,
  pointerBlocker = false
): StackPanel {
  const stack = new StackPanel(name);
  stack.isVertical = true;
  stack.spacing = spacing;
  stack.isPointerBlocker = pointerBlocker;
  stack.isHitTestVisible = true;
  return stack;
}

export function addToPanel(parent: Rectangle, child: Control, padding = GuiStyles.spacing.md): void {
  child.paddingTop = `${padding}px`;
  child.paddingBottom = `${padding}px`;
  child.paddingLeft = `${padding}px`;
  child.paddingRight = `${padding}px`;
  parent.addControl(child);
}

const HEADER_H = 100;
const CLOSE_SIZE = 36;
const EDGE = 12;

export interface ModalShell {
  overlay: Rectangle;
  panel: Rectangle;
  title: TextBlock;
  body: StackPanel;
  footer: StackPanel;
  closeButton: Button;
}

/**
 * Ровная модалка: шапка (заголовок по центру + ✕ справа), тело, футер с кнопками.
 */
export function createModalShell(
  texture: AdvancedDynamicTexture,
  name: string,
  widthPx: number,
  heightPx: number,
  options?: { zIndex?: number; showClose?: boolean }
): ModalShell {
  const showClose = options?.showClose !== false;

  const overlay = new Rectangle(`${name}Overlay`);
  overlay.width = "90%";
  overlay.height = "100%";
  overlay.thickness = 0;
  overlay.background = GuiStyles.colors.overlayBg;
  overlay.isVisible = false;
  overlay.isPointerBlocker = true;
  overlay.zIndex = options?.zIndex ?? MODAL_Z_INDEX;
  texture.addControl(overlay);

  const panel = createGlassPanel(`${name}Panel`, widthPx, heightPx, true);
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.clipChildren = true;
  overlay.addControl(panel);

  const header = new Rectangle(`${name}Header`);
  header.width = "100%";
  header.height = `${HEADER_H}px`;
  header.thickness = 0;
  header.background = "transparent";
  header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  header.isHitTestVisible = false;
  panel.addControl(header);

  const title = new TextBlock(`${name}Title`);
  title.height = `${HEADER_H}px`;
  title.width = "100%";
  title.paddingLeft = showClose ? `${CLOSE_SIZE + EDGE * 2}px` : `${EDGE}px`;
  title.paddingRight = showClose ? `${CLOSE_SIZE + EDGE * 2}px` : `${EDGE}px`;
  title.color = GuiStyles.colors.accentBright;
  title.fontSize = GuiStyles.fontSize.title;
  title.fontWeight = "700";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  title.textWrapping = true;
  title.isHitTestVisible = false;
  header.addControl(title);

  const closeButton = Button.CreateSimpleButton(`${name}Close`, "✕");
  closeButton.width = `${CLOSE_SIZE}px`;
  closeButton.height = `${CLOSE_SIZE}px`;
  closeButton.cornerRadius = GuiStyles.radius.sm;
  closeButton.thickness = 1;
  closeButton.color = GuiStyles.colors.border;
  closeButton.background = GuiStyles.colors.dangerDark;
  closeButton.fontSize = 16;
  closeButton.fontWeight = "700";
  closeButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  closeButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  closeButton.left = `-${EDGE}px`;
  closeButton.paddingLeft = "0px";
  closeButton.paddingRight = "0px";
  closeButton.isVisible = showClose;
  if (closeButton.textBlock) {
    closeButton.textBlock.color = GuiStyles.colors.text;
  }
  header.addControl(closeButton);

  const body = createVerticalStack(`${name}Body`, GuiStyles.spacing.md);
  body.width = `${widthPx - EDGE * 2}px`;
  body.height = `${heightPx - HEADER_H - 72}px`;
  body.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  body.top = `${HEADER_H}px`;
  body.paddingLeft = "20px";
  body.paddingTop = "40px";
  body.isHitTestVisible = false;
  panel.addControl(body);

  const footer = new StackPanel(`${name}Footer`);
  footer.isVertical = false;
  footer.width = "100%";
  footer.height = "64px";
  footer.spacing = 12;
  footer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  footer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  footer.paddingBottom = "14px";
  footer.isHitTestVisible = false;
  panel.addControl(footer);

  return { overlay, panel, title, body, footer, closeButton };
}

export function createModalActionButton(
  name: string,
  label: string,
  kind: "primary" | "secondary" | "danger" | "warning" = "primary",
  width = 140
): Button {
  const btn = Button.CreateSimpleButton(name, label);
  btn.width = `${width}px`;
  btn.height = "44px";
  btn.cornerRadius = GuiStyles.button.cornerRadius;
  btn.thickness = 1;
  btn.fontSize = GuiStyles.fontSize.body;
  btn.fontWeight = "600";
  btn.paddingLeft = "0px";
  btn.paddingRight = "0px";

  switch (kind) {
    case "primary":
      btn.background = GuiStyles.colors.accentDark;
      btn.color = GuiStyles.colors.borderBright;
      break;
    case "secondary":
      btn.background = GuiStyles.colors.buttonIdle;
      btn.color = GuiStyles.colors.border;
      break;
    case "danger":
      btn.background = GuiStyles.colors.dangerDark;
      btn.color = GuiStyles.colors.border;
      break;
    case "warning":
      btn.background = "#c56a1a";
      btn.color = "rgba(255, 200, 120, 0.8)";
      break;
  }
  if (btn.textBlock) {
    btn.textBlock.color = GuiStyles.colors.text;
  }
  return btn;
}

export function createModalBodyText(name: string, height = 160): TextBlock {
  const text = new TextBlock(name);
  text.width = "100%";
  text.height = `${height}px`;
  text.color = GuiStyles.colors.text;
  text.fontSize = GuiStyles.fontSize.label;
  text.textWrapping = true;
  text.lineSpacing = "4px";
  text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  text.isHitTestVisible = false;
  return text;
}
