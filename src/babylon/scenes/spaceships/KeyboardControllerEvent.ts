import { KeyboardInfo,  Nullable,   Observer,  Scene } from "@babylonjs/core";

export default class KeyboardControllerEvent{
    public up = false;
    public rotateRight = false;
    public down = false;
    public rotateLeft = false;
    public forward = false;
    public back = false;
    public left = false;
    public right = false;
    public seventhEngine = false;
    public eighthEngine = false;
    public keysPressed: { [key: string]: boolean } = {};
    private scene: Scene;
    private keyboardControllerObservable:  Nullable<Observer<KeyboardInfo>>;
    constructor(scene: Scene){
     this.scene = scene;
     this.keyboardControllerObservable = this.scene.onKeyboardObservable.add((event) => this.handleControlEvents(event));
    }
   
    public handleControlEvents(event: KeyboardInfo) {
      if (event.type === 1) {
        this.keysPressed[event.event.key] = true;
      } else if (event.type === 2) {
        this.keysPressed[event.event.key] = false;
      }
      if (event.event.code === 'KeyW' ) {
        event.type === 1 ? this.up = true : this.up = false;
      }
      if (event.event.code === 'KeyS' ) {
        event.type === 1 ? this.down = true : this.down = false;
      }
      if (event.event.code === 'KeyD' ) {
        event.type === 1 ? this.rotateRight = true : this.rotateRight = false;
      }
      if (event.event.code === 'KeyA' ) {
        event.type === 1 ? this.rotateLeft = true : this.rotateLeft = false;
      }
      if (event.event.code === 'ArrowUp' ) {
        event.type === 1 ? this.forward = true : this.forward = false;
      }
      if (event.event.code === 'ArrowDown' ) {
        event.type === 1 ? this.back = true : this.back = false;
      }
      if (event.event.code === 'ArrowRight' ) {
        event.type === 1 ? this.right = true :  this.right = false;
      }
      if (event.event.code === 'ArrowLeft' ) {
        event.type === 1 ? this.left = true : this.left = false;
      }
    }
    public dispose(){
        this.scene.onKeyboardObservable.remove(this.keyboardControllerObservable);
    }
  
}