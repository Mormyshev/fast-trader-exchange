"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { setLenisInstance } from "@/src/utils/lenis-bridge";

export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const disableLenis =
    pathname.startsWith("/operator") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/user/support");

  useEffect(() => {
    document.body.style.removeProperty("pointer-events");
    if (disableLenis) return;
    if (window.innerWidth < 1024) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      allowNestedScroll: true,
    });

    setLenisInstance(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      setLenisInstance(null);
    };
  }, [disableLenis]);

  return <>{children}</>;
}
