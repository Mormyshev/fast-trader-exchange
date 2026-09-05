export type SbpBank = {
  id: string;
  name: string;
  iconSrc: string;
};

/** Единый полный список банков для СБП и рублёвых выплат. */
export const SBP_BANKS: SbpBank[] = [
  { id: "sber", name: "Сбербанк", iconSrc: "/icons/sber.svg" },
  { id: "tbank", name: "Т-Банк", iconSrc: "/icons/tbank.svg" },
  { id: "vtb", name: "ВТБ", iconSrc: "/icons/vtb.svg" },
  { id: "alfa", name: "Альфа-Банк", iconSrc: "/icons/alfa.svg" },
  { id: "gazprombank", name: "Газпромбанк", iconSrc: "/icons/gazprombank.svg" },
  { id: "raiffeisen", name: "Райффайзенбанк", iconSrc: "/icons/raiffeisen.svg" },
  { id: "psb", name: "ПСБ", iconSrc: "/icons/psb.svg" },
  { id: "sovcom", name: "Совкомбанк", iconSrc: "/icons/sovcom.svg" },
  { id: "rshb", name: "Россельхозбанк", iconSrc: "/icons/rshb.svg" },
  { id: "mts", name: "МТС Банк", iconSrc: "/icons/mts-bank.svg" },
  { id: "ozon", name: "Озон Банк", iconSrc: "/icons/ozon-bank.svg" },
];

export function findSbpBank(id: string): SbpBank | undefined {
  return SBP_BANKS.find((bank) => bank.id === id);
}

export function findSbpBankByName(name: string): SbpBank | undefined {
  const normalized = name.trim().toLowerCase();
  return SBP_BANKS.find((bank) => bank.name.toLowerCase() === normalized);
}
