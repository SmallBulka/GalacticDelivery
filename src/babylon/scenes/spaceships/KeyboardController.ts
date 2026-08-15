import {
  KeyboardEventTypes,
  KeyboardInfo,
  Nullable,
  Observer,
  Scene,
} from "@babylonjs/core";
import { IInputProvider } from "./IInputProvider";
import { EMPTY_INPUT_STATE, IInputState } from "./IInputState";

/**
 * Клавиатурный ввод в нормализованный IInputState (−1 / 0 / 1).
 * Параметры полёта не задаёт — их применяет MovementController.
 */
export default class KeyboardController implements IInputProvider {
  private keys: Record<string, boolean> = {};
  private observer: Nullable<Observer<KeyboardInfo>> = null;

  constructor(private scene: Scene) {
    this.observer = this.scene.onKeyboardObservable.add((event) => {
      if (event.type === KeyboardEventTypes.KEYDOWN) {
        this.keys[event.event.code] = true;
      } else if (event.type === KeyboardEventTypes.KEYUP) {
        this.keys[event.event.code] = false;
      }
    });
  }

  public getInput(): IInputState {
    const thrustForward = this.isPressed("KeyW");
    const thrustBack = this.isPressed("KeyS");
    const yawLeft = this.isPressed("KeyA");
    const yawRight = this.isPressed("KeyD");
    const pitchUp = this.isPressed("ArrowUp");
    const pitchDown = this.isPressed("ArrowDown");
    const rollLeft = this.isPressed("ArrowLeft");
    const rollRight = this.isPressed("ArrowRight");

    if (
      !thrustForward &&
      !thrustBack &&
      !yawLeft &&
      !yawRight &&
      !pitchUp &&
      !pitchDown &&
      !rollLeft &&
      !rollRight
    ) {
      return EMPTY_INPUT_STATE;
    }

    return {
      thrust: (thrustForward ? 1 : 0) - (thrustBack ? 1 : 0),
      yaw: (yawRight ? 1 : 0) - (yawLeft ? 1 : 0),
      pitch: (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0),
      roll: (rollRight ? 1 : 0) - (rollLeft ? 1 : 0),
    };
  }

  /** @deprecated используйте getInput() */
  public getState(): IInputState {
    return this.getInput();
  }

  private isPressed(...codes: string[]): boolean {
    return codes.some((code) => this.keys[code]);
  }

  public dispose(): void {
    if (this.observer) {
      this.scene.onKeyboardObservable.remove(this.observer);
      this.observer = null;
    }
  }
}
