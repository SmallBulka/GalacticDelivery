import {
  AdvancedDynamicTexture,
  Control,
  Grid,
  Image,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import {
  KeyboardEventTypes,
  KeyboardInfo,
  Nullable,
  Observer,
  Scene,
} from "@babylonjs/core";
import { GuiStyles } from "./GuiStyles";
import {
  createGlassPanel,
  createVerticalStack,
  styleSectionHeader,
} from "./GuiHelpers";
import type { GamepadStickDisplay } from "../scenes/spaceships/GamepadInputProvider";

const KEY_CODES = [
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
] as const;

type TrackedKeyCode = (typeof KEY_CODES)[number];

const KEY_LABELS: Record<TrackedKeyCode, string> = {
  KeyW: "W",
  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/** Центры стиков на keyboardInput.png (доли ширины/высоты изображения). */
const LEFT_STICK_CENTER = { x: 0.335, y: 0.395 };
const RIGHT_STICK_CENTER = { x: 0.665, y: 0.585 };
const STICK_TRAVEL_PX = 16;
const GAMEPAD_IMAGE_H = 196;

/**
 * HUD ввода: клавиатура + схема геймпада с точками стиков.
 */
export class KeyboardInputDisplayUI {
  private root!: Rectangle;
  private gamepadLayer!: Rectangle;
  private leftStickDot!: Rectangle;
  private rightStickDot!: Rectangle;
  private gamepadStatus!: TextBlock;
  private keyCells = new Map<TrackedKeyCode, Rectangle>();
  private pressed = new Map<TrackedKeyCode, boolean>();
  private keyboardObserver: Nullable<Observer<KeyboardInfo>> = null;
  private renderObserver: Nullable<Observer<Scene>> = null;
  private scene: Scene | null = null;
  private blurHandler?: () => void;
  private getGamepadSticks: (() => GamepadStickDisplay) | null = null;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.root = createGlassPanel("keyboardInputDisplay", GuiStyles.hud.rightPanelWidth, 468);
    this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.root.left = `-${GuiStyles.hud.margin}px`;
    this.root.isPointerBlocker = false;
    this.advancedTexture.addControl(this.root);

    const stack = createVerticalStack("keyboardInputStack", GuiStyles.spacing.sm);
    stack.width = "94%";
    stack.paddingTop = "10px";
    stack.paddingBottom = "10px";
    this.root.addControl(stack);

    stack.addControl(styleSectionHeader(new TextBlock("kbWasdHeader"), "WASD — ДВИЖЕНИЕ"));
    stack.addControl(this.createWasdGrid());

    stack.addControl(styleSectionHeader(new TextBlock("kbArrowsHeader"), "СТРЕЛКИ — ПОВОРОТ"));
    stack.addControl(this.createArrowGrid());

    stack.addControl(styleSectionHeader(new TextBlock("kbGamepadHeader"), "ГЕЙМПАД"));
    stack.addControl(this.createGamepadPanel());
  }

  applyScale(scale: number): void {
    this.root.scaleX = scale;
    this.root.scaleY = scale;
  }

  bindScene(
    scene: Scene,
    getGamepadSticks?: () => GamepadStickDisplay
  ): void {
    this.unbindScene();
    this.scene = scene;
    this.getGamepadSticks = getGamepadSticks ?? null;

    this.keyboardObserver = scene.onKeyboardObservable.add((event) => {
      const code = event.event.code as TrackedKeyCode;
      if (!this.keyCells.has(code)) return;
      const down = event.type === KeyboardEventTypes.KEYDOWN;
      this.setPressed(code, down);
    });

    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.updateGamepadSticks();
    });

    this.blurHandler = () => this.clearAll();
    window.addEventListener("blur", this.blurHandler);
  }

  unbindScene(): void {
    if (this.keyboardObserver && this.scene) {
      this.scene.onKeyboardObservable.remove(this.keyboardObserver);
      this.keyboardObserver = null;
    }
    if (this.renderObserver && this.scene) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
    this.scene = null;
    this.getGamepadSticks = null;
    if (this.blurHandler) {
      window.removeEventListener("blur", this.blurHandler);
      this.blurHandler = undefined;
    }
    this.clearAll();
    this.resetStickDots();
  }

  private createGamepadPanel(): Rectangle {
    const panel = new Rectangle("gamepadInputPanel");
    panel.width = "100%";
    panel.height = `${GAMEPAD_IMAGE_H}px`;
    panel.thickness = 0;
    panel.background = "transparent";
    panel.isPointerBlocker = false;
    panel.isHitTestVisible = false;

    const image = new Image("gamepadInputImage", "./textures/keyboardInput.png");
    image.width = "100%";
    image.height = `${GAMEPAD_IMAGE_H}px`;
    image.stretch = Image.STRETCH_UNIFORM;
    image.isHitTestVisible = false;
    panel.addControl(image);

    this.gamepadLayer = new Rectangle("gamepadStickLayer");
    this.gamepadLayer.width = "100%";
    this.gamepadLayer.height = `${GAMEPAD_IMAGE_H}px`;
    this.gamepadLayer.thickness = 0;
    this.gamepadLayer.background = "transparent";
    this.gamepadLayer.isHitTestVisible = false;
    panel.addControl(this.gamepadLayer);

    this.leftStickDot = this.createStickDot("leftStickDot");
    this.rightStickDot = this.createStickDot("rightStickDot");
    this.gamepadLayer.addControl(this.leftStickDot);
    this.gamepadLayer.addControl(this.rightStickDot);

    this.gamepadStatus = new TextBlock("gamepadStatus", "нет геймпада");
    this.gamepadStatus.color = GuiStyles.colors.textDim;
    this.gamepadStatus.fontSize = GuiStyles.fontSize.caption;
    this.gamepadStatus.height = "16px";
    this.gamepadStatus.top = `${GAMEPAD_IMAGE_H - 6}px`;
    this.gamepadStatus.isHitTestVisible = false;
    panel.addControl(this.gamepadStatus);

    return panel;
  }

  private createStickDot(name: string): Rectangle {
    const dot = new Rectangle(name);
    dot.width = "12px";
    dot.height = "12px";
    dot.cornerRadius = 6;
    dot.thickness = 0;
    dot.background = GuiStyles.colors.accentBright;
    dot.alpha = 0.45;
    dot.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    dot.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    dot.isHitTestVisible = false;
    return dot;
  }

  private updateGamepadSticks(): void {
    const sticks = this.getGamepadSticks?.() ?? {
      connected: false,
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
    };

    if (!sticks.connected) {
      this.gamepadStatus.text = "нет геймпада";
      this.gamepadStatus.color = GuiStyles.colors.textDim;
      this.resetStickDots();
      return;
    }

    this.gamepadStatus.text = "подключён";
    this.gamepadStatus.color = GuiStyles.colors.success;

    this.placeStickDot(
      this.leftStickDot,
      LEFT_STICK_CENTER.x,
      LEFT_STICK_CENTER.y,
      sticks.leftX,
      sticks.leftY
    );
    this.placeStickDot(
      this.rightStickDot,
      RIGHT_STICK_CENTER.x,
      RIGHT_STICK_CENTER.y,
      sticks.rightX,
      sticks.rightY
    );
  }

  private placeStickDot(
    dot: Rectangle,
    centerXRatio: number,
    centerYRatio: number,
    axisX: number,
    axisY: number
  ): void {
    const layerW = this.gamepadLayer.widthInPixels || GuiStyles.hud.rightPanelWidth * 0.94;
    const layerH = GAMEPAD_IMAGE_H;

    const centerX = layerW * centerXRatio;
    const centerY = layerH * centerYRatio;
    const magnitude = Math.sqrt(axisX * axisX + axisY * axisY);

    dot.left = `${centerX + axisX * STICK_TRAVEL_PX - 6}px`;
    dot.top = `${centerY + axisY * STICK_TRAVEL_PX - 6}px`;
    dot.alpha = magnitude > 0.08 ? 1 : 0.55;
    dot.background =
      magnitude > 0.35 ? GuiStyles.colors.success : GuiStyles.colors.accentBright;
  }

  private resetStickDots(): void {
    this.placeStickDot(this.leftStickDot, LEFT_STICK_CENTER.x, LEFT_STICK_CENTER.y, 0, 0);
    this.placeStickDot(this.rightStickDot, RIGHT_STICK_CENTER.x, RIGHT_STICK_CENTER.y, 0, 0);
    this.leftStickDot.alpha = 0.45;
    this.rightStickDot.alpha = 0.45;
  }

  private createWasdGrid(): Grid {
    const grid = this.createKeyGrid("wasd");
    this.addKeyCell(grid, "KeyW", 0, 1);
    this.addKeyCell(grid, "KeyA", 1, 0);
    this.addKeyCell(grid, "KeyS", 1, 1);
    this.addKeyCell(grid, "KeyD", 1, 2);
    return grid;
  }

  private createArrowGrid(): Grid {
    const grid = this.createKeyGrid("arrows");
    this.addKeyCell(grid, "ArrowUp", 0, 1);
    this.addKeyCell(grid, "ArrowLeft", 1, 0);
    this.addKeyCell(grid, "ArrowDown", 1, 1);
    this.addKeyCell(grid, "ArrowRight", 1, 2);
    return grid;
  }

  private createKeyGrid(name: string): Grid {
    const grid = new Grid(`keyboardGrid_${name}`);
    grid.width = "100%";
    grid.height = "84px";
    grid.addColumnDefinition(1, false);
    grid.addColumnDefinition(1, false);
    grid.addColumnDefinition(1, false);
    grid.addRowDefinition(40, true);
    grid.addRowDefinition(40, true);
    grid.isPointerBlocker = false;
    return grid;
  }

  private addKeyCell(
    grid: Grid,
    code: TrackedKeyCode,
    row: number,
    column: number
  ): void {
    const cell = new Rectangle(`keyboardKey_${code}`);
    cell.width = "48px";
    cell.height = "38px";
    cell.cornerRadius = GuiStyles.radius.sm;
    cell.isPointerBlocker = false;
    cell.isHitTestVisible = false;
    this.applyIdleStyle(cell);

    const label = new TextBlock(`keyboardKeyLabel_${code}`, KEY_LABELS[code]);
    label.color = GuiStyles.colors.text;
    label.fontSize = code.startsWith("Arrow") ? 18 : 15;
    label.fontWeight = "700";
    label.isHitTestVisible = false;
    cell.addControl(label);

    grid.addControl(cell, row, column);
    this.keyCells.set(code, cell);
    this.pressed.set(code, false);
  }

  private setPressed(code: TrackedKeyCode, down: boolean): void {
    if (this.pressed.get(code) === down) return;
    this.pressed.set(code, down);

    const cell = this.keyCells.get(code);
    if (!cell) return;

    if (down) {
      cell.background = GuiStyles.colors.accentDark;
      cell.color = GuiStyles.colors.accentBright;
      cell.thickness = 2;
    } else {
      this.applyIdleStyle(cell);
    }
  }

  private applyIdleStyle(cell: Rectangle): void {
    cell.background = GuiStyles.colors.keyIdle;
    cell.color = GuiStyles.colors.keyBorder;
    cell.thickness = 1;
  }

  private clearAll(): void {
    for (const code of KEY_CODES) {
      this.setPressed(code, false);
    }
  }
}
