"use client";

import { cn } from "@/lib/utils";
import {
  avatarToneClass,
  avatarToneFromProfile,
  staffRoleInitial,
  type AvatarTone,
  type StaffRoleLike,
} from "@/src/utils/staff/permissions";

export default function OperatorAvatar({
  name,
  size = "md",
  className,
  tone,
  profile,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
  tone?: AvatarTone;
  profile?: StaffRoleLike | null;
}) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const resolved = tone ?? (profile ? avatarToneFromProfile(profile) : "operator");
  const initial = staffRoleInitial(profile, resolved);

  return (
    <div
      className={cn(
        "rounded-full border flex items-center justify-center font-bold shrink-0",
        avatarToneClass(resolved),
        sizeClass,
        className,
      )}
      title={name}
      aria-hidden
    >
      {initial}
    </div>
  );
}
