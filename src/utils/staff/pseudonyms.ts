export const OPERATOR_PSEUDONYMS = [
  "Алексей",
  "Анна",
  "Артём",
  "Виктория",
  "Дмитрий",
  "Екатерина",
  "Елена",
  "Иван",
  "Ирина",
  "Максим",
  "Мария",
  "Михаил",
  "Наталья",
  "Никита",
  "Ольга",
  "Павел",
  "Роман",
  "Сергей",
  "Татьяна",
  "Юлия",
] as const;

export type OperatorPseudonym = (typeof OPERATOR_PSEUDONYMS)[number];

export function isListedOperatorPseudonym(value: string): boolean {
  const trimmed = value.trim();
  return (OPERATOR_PSEUDONYMS as readonly string[]).includes(trimmed);
}
