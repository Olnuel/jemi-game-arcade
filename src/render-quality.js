// Renderer settings, chosen once for the device.
//
// Phones were the worst case for two reasons. The canvas is full screen, so every
// extra pixel ratio is paid for across the whole display; and a 3x screen clamped to
// 1.8 still renders over three times the fragments of a 1x one, on a GPU that is
// usually also driving the browser itself. On top of that, antialiasing and soft
// shadow filtering are two of the most expensive things you can leave switched on.
//
// So the low-power path drops the pixel ratio to 1, turns multisampling off and uses
// the cheap shadow filter. The canvas is then upscaled by the compositor, which costs
// a little sharpness and saves a great deal of frame time.

const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

function isCoarsePointer() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

const isMobile = isCoarsePointer() || /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua);
// Four cores or fewer covers most budget phones and older tablets.
const lowPower = isMobile || cores <= 4;

export const QUALITY = {
  lowPower,
  isMobile,
  // 1.8 costs 3.2x the fragments of 1.0 on a high density screen.
  pixelRatioCap: lowPower ? 1 : 1.8,
  antialias: !lowPower,
  softShadows: !lowPower,
  // The sun's shadow map was a fixed 1024 on every device; halving it quarters the
  // shadow pass cost and is the difference between a soft edge and a slightly harder one.
  shadowMapSize: lowPower ? 512 : 1024,
  // Keep the cheap path responsive even on a device we misjudged.
  governorFloor: lowPower ? 0.6 : 0.75,
};

/** Renderer constructor options for this device. */
export function rendererOptions(canvas) {
  return { canvas, antialias: QUALITY.antialias, alpha: false };
}

/** The pixel ratio this device should start at. */
export function startPixelRatio() {
  return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, QUALITY.pixelRatioCap);
}

/**
 * Watches the frame time and steps the pixel ratio down if the run is not keeping up.
 * It only ever lowers the ratio, never raises it, so it settles instead of
 * oscillating, and it stops well short of a blur.
 */
export function createFrameGovernor(applyRatio) {
  const floor = QUALITY.governorFloor;
  let current = startPixelRatio();
  let samples = 0;
  let accumulator = 0;
  let strikes = 0;
  applyRatio(current);

  return function governor(dt) {
    samples += 1;
    accumulator += dt;
    if (samples < 45) return;
    const mean = accumulator / samples;
    samples = 0;
    accumulator = 0;
    // 22ms is about 45fps, comfortably under the 16.7ms we would like but low
    // enough not to fire on a single slow frame.
    if (mean > 0.022) {
      strikes += 1;
      if (strikes >= 2 && current > floor) {
        current = Math.max(floor, current - 0.25);
        strikes = 0;
        applyRatio(current);
      }
    } else {
      strikes = 0;
    }
  };
}
