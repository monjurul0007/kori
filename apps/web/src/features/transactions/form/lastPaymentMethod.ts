const LAST_METHOD_KEY = "kori.lastPaymentMethod";

// Storage can be blocked (private mode). That is an expected case, not a fault, so both
// helpers fall back silently and saving a transaction never depends on them.
export function rememberedMethod(): string {
  try {
    return localStorage.getItem(LAST_METHOD_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberMethod(id: string) {
  try {
    localStorage.setItem(LAST_METHOD_KEY, id);
  } catch {
    // Nothing to do: the next entry just starts without a remembered method.
  }
}
