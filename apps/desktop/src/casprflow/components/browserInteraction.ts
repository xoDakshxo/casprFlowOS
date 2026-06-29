export function shouldBrowserCaptureInput(focused: boolean, selected: boolean): boolean {
  return focused && selected;
}
