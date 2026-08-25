export const WEEKDAYS = [
  { id: 1, short: "Пн", full: "Понедельник" },
  { id: 2, short: "Вт", full: "Вторник" },
  { id: 3, short: "Ср", full: "Среда" },
  { id: 4, short: "Чт", full: "Четверг" },
  { id: 5, short: "Пт", full: "Пятница" },
  { id: 6, short: "Сб", full: "Суббота" },
  { id: 7, short: "Вс", full: "Воскресенье" },
] as const;

export type WeekdayId = (typeof WEEKDAYS)[number]["id"];

export type ScheduleShift = {
  operator_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isoWeekday(date = new Date()): WeekdayId {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as WeekdayId;
}

export function formatClock(value: string): string {
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function parseClock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const formatted = `${match[1].padStart(2, "0")}:${match[2]}`;
  return TIME_RE.test(formatted) ? formatted : null;
}

export function minutesOfDay(clock: string): number {
  const [hours, minutes] = formatClock(clock).split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatShiftRange(shift: {
  starts_at: string;
  ends_at: string;
}): string {
  return `${formatClock(shift.starts_at)}–${formatClock(shift.ends_at)}`;
}

export function isOvernightShift(shift: {
  starts_at: string;
  ends_at: string;
}): boolean {
  return minutesOfDay(shift.ends_at) <= minutesOfDay(shift.starts_at);
}

export function isShiftActiveNow(
  shift: { starts_at: string; ends_at: string },
  now = new Date(),
): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesOfDay(shift.starts_at);
  const end = minutesOfDay(shift.ends_at);
  if (end <= start) {
    return current >= start || current < end;
  }
  return current >= start && current < end;
}

export function weekdayLabel(id: number, kind: "short" | "full" = "short") {
  const found = WEEKDAYS.find((day) => day.id === id);
  if (!found) return String(id);
  return kind === "full" ? found.full : found.short;
}
