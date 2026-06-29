export interface BrowserWindowSize {
  width: number;
  height: number;
}

interface BrowserWindowBounds extends BrowserWindowSize {
  x: number;
  y: number;
}

interface DeviceViewport {
  width: number;
  height: number;
}

export function resolveBrowserWindowSize(
  viewport: DeviceViewport,
  chromeHeight: number,
): BrowserWindowSize {
  return {
    width: viewport.width,
    height: viewport.height + chromeHeight,
  };
}

export function resolveCenteredBrowserBounds(
  currentBounds: BrowserWindowBounds,
  viewport: DeviceViewport,
  chromeHeight: number,
): BrowserWindowBounds {
  const nextSize = resolveBrowserWindowSize(viewport, chromeHeight);

  return {
    x: currentBounds.x + (currentBounds.width - nextSize.width) / 2,
    y: currentBounds.y + (currentBounds.height - nextSize.height) / 2,
    ...nextSize,
  };
}
