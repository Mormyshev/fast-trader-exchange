"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type UIEvent,
} from "react";

type SlimScrollProps = {
  children: ReactNode;
  className?: string;
  maxHeightClassName?: string;
};

/** Запас под ширину системного скроллбара Windows (~12–17px) */
const NATIVE_SCROLLBAR_GUTTER = 24;

/**
 * Контент и ползунок в разных колонках: выделение не заходит под скролл.
 * Native scrollbar обрезается за правым краем контентной колонки.
 */
export default function SlimScroll({
  children,
  className = "",
  maxHeightClassName = "max-h-60",
}: SlimScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({
    top: 0,
    height: 0,
    visible: false,
  });
  const dragging = useRef<{ startY: number; startTop: number } | null>(null);

  const syncThumb = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight > clientHeight + 1;
    if (!overflow) {
      setThumb({ top: 0, height: 0, visible: false });
      return;
    }

    const trackH = trackRef.current?.clientHeight || clientHeight;
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * trackH, 28);
    const maxTop = trackH - height;
    const top =
      maxTop <= 0
        ? 0
        : (scrollTop / (scrollHeight - clientHeight)) * maxTop;

    setThumb({ top, height, visible: true });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    syncThumb();

    const ro = new ResizeObserver(() => syncThumb());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    if (trackRef.current) ro.observe(trackRef.current);

    window.addEventListener("resize", syncThumb);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncThumb);
    };
  }, [syncThumb, children, thumb.visible]);

  const onScroll = (_e: UIEvent<HTMLDivElement>) => {
    syncThumb();
  };

  const onThumbPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = { startY: e.clientY, startTop: thumb.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onThumbPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !viewportRef.current) return;
    const el = viewportRef.current;
    const trackH = trackRef.current?.clientHeight || el.clientHeight;
    const height = thumb.height;
    const maxTop = trackH - height;
    if (maxTop <= 0) return;

    const delta = e.clientY - dragging.current.startY;
    const nextTop = Math.min(
      maxTop,
      Math.max(0, dragging.current.startTop + delta),
    );
    const scrollMax = el.scrollHeight - el.clientHeight;
    el.scrollTop = (nextTop / maxTop) * scrollMax;
  };

  const onThumbPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div className={`flex ${maxHeightClassName} ${className}`}>
      {/* Контент */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          ref={viewportRef}
          onScroll={onScroll}
          data-lenis-prevent
          className="h-full overflow-y-scroll overflow-x-hidden"
          style={{
            width: `calc(100% + ${NATIVE_SCROLLBAR_GUTTER}px)`,
            maxWidth: "none",
            marginRight: `-${NATIVE_SCROLLBAR_GUTTER}px`,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {children}
        </div>
      </div>

      {/* Отдельная колонка под ползунок — не перекрывает карточки */}
      {thumb.visible && (
        <div
          aria-hidden
          className="flex w-4 shrink-0 justify-center py-3 pr-1"
        >
          <div ref={trackRef} className="relative h-full w-1">
            <div
              className="absolute left-0 w-full cursor-pointer rounded-full bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500"
              style={{ top: thumb.top, height: thumb.height }}
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
              onPointerCancel={onThumbPointerUp}
            />
          </div>
        </div>
      )}
    </div>
  );
}
