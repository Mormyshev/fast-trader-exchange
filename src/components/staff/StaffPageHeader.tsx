export default function StaffPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-zinc-900">
        {title}
      </h1>
      {description && (
        <p className="text-xs sm:text-sm font-medium text-zinc-400">
          {description}
        </p>
      )}
    </div>
  );
}
