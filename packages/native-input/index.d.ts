export function injectMouseMove(x: number, y: number): void;
export function injectMouseAction(button: 'left' | 'right' | 'middle', action: 'down' | 'up'): void;
export function injectMouseScroll(deltaX: number, deltaY: number): void;
export function injectKeyAction(vk: number, action: 'down' | 'up'): void;
export function isKeyToggled(vk: number): boolean;
export function injectText(text: string): void;
export function focusIsEditable(): Promise<boolean>;

/** A physical key the low-level hook swallowed locally (viewer side). */
export interface HookKeyEvent {
  vk: number;
  scan: number;
  down: boolean;
  extended: boolean;
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
}
/** Install the WH_KEYBOARD_LL hook (starts disabled). Returns false if Windows refused it. */
export function startKeyboardHook(callback: (event: HookKeyEvent) => void): boolean;
export function stopKeyboardHook(): void;
export function setKeyboardHookEnabled(enabled: boolean): void;
/** Top-level HWND whose foreground state arms the hook. */
export function setKeyboardHookTarget(hwnd: number | bigint): void;
export function isKeyboardHookActive(): boolean;
