export interface IInputState {
  /** W/S — тяга вперёд/назад */
  thrust: number;
  /** A/D — рысканье (поворот влево/вправо) */
  yaw: number;
  /** ArrowUp/ArrowDown — тангаж (нос вверх/вниз) */
  pitch: number;
  /** ArrowLeft/ArrowRight — крен (наклон вбок) */
  roll: number;
}

export const EMPTY_INPUT_STATE: IInputState = {
  thrust: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
};
