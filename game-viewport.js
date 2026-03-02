// Viewport and DPR canvas sizing helper.

export function createViewport(canvas, baseWidth = 960, baseHeight = 640, maxScale = 1.3) {
  let viewWidth = 0;
  let viewHeight = 0;
  let uiScale = 1;

  function resize() {
    viewWidth = window.innerWidth;
    viewHeight = window.innerHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${viewWidth}px`;
    canvas.style.height = `${viewHeight}px`;
    canvas.width = Math.round(viewWidth * dpr);
    canvas.height = Math.round(viewHeight * dpr);

    uiScale = Math.min(viewWidth / baseWidth, viewHeight / baseHeight, maxScale);
    return { dpr, viewWidth, viewHeight, uiScale };
  }

  function getViewSize() {
    return { viewWidth, viewHeight };
  }

  function getUiScale() {
    return uiScale;
  }

  return {
    resize,
    getViewSize,
    getUiScale,
  };
}
