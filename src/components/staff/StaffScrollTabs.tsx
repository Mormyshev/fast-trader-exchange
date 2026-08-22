"use client";

export default function StaffScrollTabs({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div className="inline-flex h-10 min-w-full sm:min-w-0 flex-nowrap items-center gap-1 bg-zinc-100/70 p-1 rounded-2xl">
        {children}
      </div>
    </div>
  );
}
