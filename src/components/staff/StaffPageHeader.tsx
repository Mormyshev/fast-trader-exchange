export default function StaffPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A]">
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
