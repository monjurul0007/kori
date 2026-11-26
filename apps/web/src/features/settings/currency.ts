const CURRENCY_LABELS: Record<string, string> = { BDT: "Taka (৳, BDT)" };

export function currencyLabel(code: string): string {
  return CURRENCY_LABELS[code] ?? code;
}
