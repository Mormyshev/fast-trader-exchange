import type Lenis from "lenis";

let instance: Lenis | null = null;
let locks = 0;

export function setLenisInstance(lenis: Lenis | null) {
  instance = lenis;
}

export function getLenisInstance() {
  return instance;
}

function restorePointerEvents() {
  document.body.style.removeProperty("pointer-events");
  document.documentElement.style.removeProperty("pointer-events");
}

export function lockPageScroll() {
  locks += 1;
  if (locks === 1) {
    getLenisInstance()?.stop();
    document.body.style.overflow = "hidden";
  }
}

export function unlockPageScroll() {
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;

  document.body.style.removeProperty("overflow");
  restorePointerEvents();
  const lenis = getLenisInstance();
  if (lenis) {
    lenis.start();
  } else {
    document.documentElement.style.removeProperty("overflow");
  }
}
