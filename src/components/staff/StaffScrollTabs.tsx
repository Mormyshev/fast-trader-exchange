"use client";

import { useEffect, useRef } from "react";

export default function StaffScrollTabs({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const mostlyVertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
      if (!mostlyVertical || event.deltaY === 0) return;
      el.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={scrollerRef}
      data-lenis-prevent
      className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div className="inline-flex h-10 w-max min-w-full flex-nowrap items-center gap-1 bg-white p-1 rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
        {children}
      </div>
    </div>
  );
}
