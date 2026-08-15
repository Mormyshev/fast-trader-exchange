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
      className={`-mx-1 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div className="inline-flex min-w-full sm:min-w-0 flex-nowrap gap-1 bg-zinc-100/70 p-1 rounded-2xl">
        {children}
      </div>
    </div>
  );
}
