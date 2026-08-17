import type Lenis from "lenis";

let instance: Lenis | null = null;

export function setLenisInstance(lenis: Lenis | null) {
  instance = lenis;
}

export function getLenisInstance() {
  return instance;
}

export function lockPageScroll() {
  getLenisInstance()?.stop();
  document.body.style.overflow = "hidden";
}

export function unlockPageScroll() {
  document.body.style.removeProperty("overflow");
  const lenis = getLenisInstance();
  if (lenis) {
    lenis.start();
  } else {
    document.documentElement.style.removeProperty("overflow");
  }
}
