import {
  Scene,
  GamepadManager,
  Xbox360Pad,
  DualShockPad,
  GenericPad,
  Gamepad,
} from "@babylonjs/core";
import { IInputProvider } from "./IInputProvider";
import { IInputState, EMPTY_INPUT_STATE } from "./IInputState";

/** Фильтр люфта стика (аппаратный), не параметр полёта. */
const DEFAULT_STICK_DEADZONE = 0.15;

/**
 * Читает оси геймпада в нормализованный IInputState (−1…1).
 * Скорость, ускорение и damping задаются через FlightSettingsConfig / MovementController.
 */
export class GamepadInputProvider implements IInputProvider {
  private gamepadManager: GamepadManager;
  private activeGamepad: Gamepad | null = null;
  private readonly deadzone: number;

  constructor(scene: Scene, deadzone = DEFAULT_STICK_DEADZONE) {
    this.deadzone = deadzone;
    this.gamepadManager = scene.gamepadManager ?? new GamepadManager(scene);

    this.gamepadManager.onGamepadConnectedObservable.add((gamepad) => {
      if (
        gamepad instanceof Xbox360Pad ||
        gamepad instanceof DualShockPad ||
        gamepad instanceof GenericPad
      ) {
        this.activeGamepad = gamepad;
      }
    });

    this.gamepadManager.onGamepadDisconnectedObservable.add((gamepad) => {
      if (this.activeGamepad === gamepad) {
        this.activeGamepad = null;
      }
    });
  }

  public getInput(): IInputState {
    if (!this.activeGamepad) {
      return EMPTY_INPUT_STATE;
    }

    const pad = this.activeGamepad;

    // Левый стик Y: в API вверх = −1 → thrust +1 вперёд
    const thrust = -this.applyDeadzone(pad.leftStick.y);
    const yaw = this.applyDeadzone(pad.leftStick.x);
    // Правый стик Y: инвертируем, чтобы вверх = pitch + (нос вверх), как ArrowUp
    const pitch = -this.applyDeadzone(pad.rightStick.y);
    const roll = this.applyDeadzone(pad.rightStick.x);

    if (thrust === 0 && yaw === 0 && pitch === 0 && roll === 0) {
      return EMPTY_INPUT_STATE;
    }

    return { thrust, yaw, pitch, roll };
  }

  private applyDeadzone(value: number): number {
    if (Math.abs(value) < this.deadzone) {
      return 0;
    }
    const sign = Math.sign(value);
    return sign * ((Math.abs(value) - this.deadzone) / (1 - this.deadzone));
  }
}
