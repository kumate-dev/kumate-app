import { createSignal, onCleanup } from 'solid-js';

/**
 * One clock for the entire application.
 *
 * ## Why this file exists
 *
 * The React implementation ran `setInterval(fn, 1000)` **per table row** via
 * `AgeCell`, used in 72 files. A 500-row pod list meant 500 timers firing every
 * second. Someone had already noticed the cost and worked around it by writing
 * `el.textContent` directly through a ref to dodge React's reconciler — which is the
 * clearest possible signal that the render model, not the timer, was the problem.
 *
 * Here there is a single interval and a single signal. Every age cell is a fine-grained
 * text binding on it, so one tick updates exactly the visible text nodes and nothing
 * else. This is free, and it is why age columns are no longer a performance concern.
 *
 * The interval is 1s only while something subscribes within the browser's idea of
 * "visible"; it pauses when the window is hidden, because a background monitoring tool
 * repainting a timestamp column is pure waste.
 */

const [now, setNow] = createSignal(Date.now());

let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;

const tick = () => setNow(Date.now());

const start = () => {
  if (timer !== null) return;
  tick();
  timer = setInterval(tick, 1000);
};

const stop = () => {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
};

const onVisibilityChange = () => {
  if (document.hidden) {
    stop();
  } else if (subscribers > 0) {
    start();
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibilityChange);
}

/**
 * Subscribe the calling component to the shared clock.
 *
 * Returns the `now` accessor. Read it inside JSX so the binding is tracked.
 */
export function useClock() {
  subscribers += 1;
  if (!document.hidden) start();

  onCleanup(() => {
    subscribers -= 1;
    if (subscribers === 0) stop();
  });

  return now;
}

/** Untracked read, for one-off formatting outside a reactive scope. */
export const currentTime = () => Date.now();
